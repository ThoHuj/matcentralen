import { HttpError, tx } from './db.js';
import { CATEGORIES, guessCategory } from './categories.js';
import { formatAmount, nameKey, parseQuickItem, toBase, unitsForDim } from './units.js';

const sv = new Intl.Collator('sv');
const EPSILON = 1e-6;

const capitalize = (name) => name.charAt(0).toUpperCase() + name.slice(1);
const round = (n) => Math.round(n * 1000) / 1000;

// Vikt först, sedan volym, sedan styckmått.
const dimOrder = (dim) => (dim === 'w' ? 0 : dim === 'v' ? 1 : 2);

function readStates(db) {
  const states = new Map();
  for (const row of db.prepare('SELECT key, checked, have FROM item_state').all()) {
    let have = {};
    try {
      have = JSON.parse(row.have) ?? {};
    } catch {
      // Trasig JSON behandlas som "inget hemma".
    }
    states.set(row.key, { checked: row.checked === 1, have });
  }
  return states;
}

/**
 * Bygger inköpslistan: valda recept skalas till önskat antal portioner,
 * egna tillägg läggs på och samma vara summeras till en rad.
 */
export function buildList(db) {
  const recipes = db
    .prepare(
      `SELECT p.recipe_id AS recipeId, r.name, p.servings, r.servings AS baseServings
         FROM plan_recipes p JOIN recipes r ON r.id = p.recipe_id
        ORDER BY p.added_at, p.recipe_id`,
    )
    .all();

  const rows = new Map();
  const add = (name, amount, unit, source) => {
    const key = nameKey(name);
    if (!key) return;
    let row = rows.get(key);
    if (!row) {
      row = { key, name: capitalize(name.trim()), needs: new Map(), unspecified: false, sources: [] };
      rows.set(key, row);
    }
    const quantity = toBase(amount, unit);
    if (quantity) {
      row.needs.set(quantity.dim, (row.needs.get(quantity.dim) ?? 0) + quantity.base);
    } else {
      row.unspecified = true;
    }
    row.sources.push({ ...source, text: quantity ? formatAmount(quantity.base, quantity.dim).text : '' });
  };

  const ingredientsOf = db.prepare(
    'SELECT name, amount, unit FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position',
  );
  for (const recipe of recipes) {
    const factor = recipe.servings / recipe.baseServings;
    for (const ing of ingredientsOf.all(recipe.recipeId)) {
      const amount = ing.amount == null ? null : ing.amount * factor;
      add(ing.name, amount, ing.unit, { type: 'recipe', id: recipe.recipeId, label: recipe.name });
    }
  }
  for (const item of db.prepare('SELECT id, name, amount, unit FROM manual_items ORDER BY id').all()) {
    add(item.name, item.amount, item.unit, { type: 'manual', id: item.id, label: 'Eget tillägg' });
  }

  const states = readStates(db);
  const learned = new Map(
    db.prepare('SELECT key, category FROM ingredient_categories').all().map((r) => [r.key, r.category]),
  );

  const items = [...rows.values()].map((row) => {
    const state = states.get(row.key) ?? { checked: false, have: {} };
    const parts = [...row.needs.entries()]
      .sort(([a], [b]) => dimOrder(a) - dimOrder(b) || sv.compare(a, b))
      .map(([dim, rawNeed]) => {
        const need = round(rawNeed);
        const have = round(Math.max(0, Number(state.have[dim]) || 0));
        const buy = round(Math.max(0, need - have));
        const shown = formatAmount(need, dim);
        return {
          dim,
          need,
          have,
          buy,
          needText: shown.text,
          haveText: have > 0 ? formatAmount(have, dim).text : '',
          buyText: buy > 0 ? formatAmount(buy, dim).text : '',
          unit: shown.unit,
          units: unitsForDim(dim),
        };
      });
    const covered = parts.length > 0 && parts.every((part) => part.buy <= EPSILON);
    const category = learned.get(row.key) ?? guessCategory(row.key);
    return {
      key: row.key,
      name: row.name,
      category: CATEGORIES.includes(category) ? category : guessCategory(row.key),
      checked: state.checked,
      covered,
      done: state.checked || covered,
      unspecified: row.unspecified,
      parts,
      sources: row.sources,
    };
  });

  items.sort(
    (a, b) =>
      CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || sv.compare(a.name, b.name),
  );

  return { recipes, items };
}

export function setPlanRecipe(db, recipeId, servings) {
  const exists = db.prepare('SELECT 1 AS ok FROM recipes WHERE id = ?').get(recipeId);
  if (!exists) throw new HttpError(404, 'Receptet finns inte.');
  db.prepare(
    `INSERT INTO plan_recipes (recipe_id, servings) VALUES (?, ?)
     ON CONFLICT(recipe_id) DO UPDATE SET servings = excluded.servings`,
  ).run(recipeId, servings);
}

export function removePlanRecipe(db, recipeId) {
  db.prepare('DELETE FROM plan_recipes WHERE recipe_id = ?').run(recipeId);
}

export function addManualItem(db, input) {
  const item = parseQuickItem(input);
  if (!item || !item.name) throw new HttpError(400, 'Skriv vad som ska läggas till.');
  if (item.amount != null && !(item.amount > 0)) throw new HttpError(400, 'Mängden måste vara större än 0.');
  db.prepare('INSERT INTO manual_items (name, amount, unit) VALUES (?, ?, ?)').run(
    item.name.slice(0, 120),
    item.amount,
    item.unit,
  );
}

export function removeManualItem(db, id) {
  db.prepare('DELETE FROM manual_items WHERE id = ?').run(id);
}

/**
 * Uppdaterar avprickning och/eller hur mycket som finns hemma för en vara.
 * have är en lista av { dim, amount, unit }; amount 0 tar bort avdraget.
 */
export function setItemState(db, { key, checked, have }) {
  const id = nameKey(key);
  if (!id) throw new HttpError(400, 'Vara saknas.');
  tx(db, () => {
    const state = readStates(db).get(id) ?? { checked: false, have: {} };
    if (typeof checked === 'boolean') state.checked = checked;
    if (Array.isArray(have)) {
      for (const entry of have) {
        const dim = String(entry?.dim ?? '');
        const amount = Number(entry?.amount);
        if (!dim) throw new HttpError(400, 'Ogiltig mängd.');
        if (!Number.isFinite(amount) || amount < 0) throw new HttpError(400, 'Mängden måste vara ett tal.');
        if (amount === 0) {
          delete state.have[dim];
          continue;
        }
        const quantity = toBase(amount, entry.unit);
        if (!quantity || quantity.dim !== dim) throw new HttpError(400, 'Enheten passar inte varan.');
        state.have[dim] = quantity.base;
      }
    }
    db.prepare(
      `INSERT INTO item_state (key, checked, have) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET checked = excluded.checked, have = excluded.have`,
    ).run(id, state.checked ? 1 : 0, JSON.stringify(state.have));
  });
}

export function setCategory(db, key, category) {
  const id = nameKey(key);
  if (!id) throw new HttpError(400, 'Vara saknas.');
  if (!CATEGORIES.includes(category)) throw new HttpError(400, 'Okänd avdelning.');
  db.prepare(
    `INSERT INTO ingredient_categories (key, category) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET category = excluded.category`,
  ).run(id, category);
}

/** Börjar om: tömmer valda recept, egna tillägg och all avprickning. */
export function clearList(db) {
  tx(db, () => {
    db.exec('DELETE FROM plan_recipes; DELETE FROM manual_items; DELETE FROM item_state;');
  });
}
