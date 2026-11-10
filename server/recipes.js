import { HttpError, tx } from './db.js';
import { CATEGORIES } from './categories.js';
import { nameKey, normalizeUnit } from './units.js';

const sv = new Intl.Collator('sv');

function text(value, max, label) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${label} måste vara text.`);
  return value.trim().slice(0, max);
}

export function parseServings(value) {
  const servings = Number(value);
  if (!Number.isFinite(servings) || servings <= 0 || servings > 1000) {
    throw new HttpError(400, 'Antal portioner måste vara ett tal större än 0.');
  }
  return servings;
}

function parseSourceUrl(value) {
  const url = text(value, 2000, 'Länken');
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) throw new HttpError(400, 'Länken måste börja med http:// eller https://.');
  return url;
}

function parseIngredient(raw) {
  if (raw == null || typeof raw !== 'object') throw new HttpError(400, 'Ogiltig ingrediens.');
  const name = text(raw.name, 120, 'Ingrediensens namn');
  if (!name) throw new HttpError(400, 'Varje ingrediens behöver ett namn.');
  let amount = null;
  if (raw.amount != null && raw.amount !== '') {
    amount = Number(raw.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpError(400, `Mängden för "${name}" måste vara ett tal större än 0.`);
    }
  }
  return {
    name,
    amount,
    unit: amount == null ? null : normalizeUnit(raw.unit),
    note: text(raw.note, 200, 'Anteckningen'),
    category: CATEGORIES.includes(raw.category) ? raw.category : null,
  };
}

export function parseRecipe(body) {
  if (body == null || typeof body !== 'object') throw new HttpError(400, 'Ogiltigt recept.');
  const name = text(body.name, 200, 'Namnet');
  if (!name) throw new HttpError(400, 'Receptet behöver ett namn.');
  if (!Array.isArray(body.ingredients)) throw new HttpError(400, 'Ingredienser saknas.');
  if (body.ingredients.length > 200) throw new HttpError(400, 'För många ingredienser.');
  return {
    name,
    servings: parseServings(body.servings),
    sourceUrl: parseSourceUrl(body.sourceUrl),
    instructions: text(body.instructions, 20000, 'Instruktionerna'),
    notes: text(body.notes, 5000, 'Anteckningarna'),
    ingredients: body.ingredients.map(parseIngredient),
  };
}

export function listRecipes(db) {
  return db
    .prepare(
      `SELECT r.id, r.name, r.servings, r.source_url AS sourceUrl,
              (SELECT COUNT(*) FROM recipe_ingredients i WHERE i.recipe_id = r.id) AS ingredientCount,
              p.servings AS plannedServings
         FROM recipes r
         LEFT JOIN plan_recipes p ON p.recipe_id = r.id`,
    )
    .all()
    .sort((a, b) => sv.compare(a.name, b.name));
}

export function getRecipe(db, id) {
  const recipe = db
    .prepare(
      `SELECT r.id, r.name, r.servings, r.source_url AS sourceUrl, r.instructions, r.notes,
              p.servings AS plannedServings
         FROM recipes r
         LEFT JOIN plan_recipes p ON p.recipe_id = r.id
        WHERE r.id = ?`,
    )
    .get(id);
  if (!recipe) throw new HttpError(404, 'Receptet finns inte.');
  const ingredients = db
    .prepare('SELECT name, amount, unit, note FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position')
    .all(id);
  return { ...recipe, ingredients };
}

/** Skapar (id = null) eller ersätter ett recept. Returnerar receptets id. */
export function saveRecipe(db, id, recipe) {
  return tx(db, () => {
    if (id == null) {
      const result = db
        .prepare('INSERT INTO recipes (name, servings, source_url, instructions, notes) VALUES (?, ?, ?, ?, ?)')
        .run(recipe.name, recipe.servings, recipe.sourceUrl, recipe.instructions, recipe.notes);
      id = Number(result.lastInsertRowid);
    } else {
      const result = db
        .prepare(
          `UPDATE recipes SET name = ?, servings = ?, source_url = ?, instructions = ?, notes = ?,
                  updated_at = datetime('now') WHERE id = ?`,
        )
        .run(recipe.name, recipe.servings, recipe.sourceUrl, recipe.instructions, recipe.notes, id);
      if (result.changes === 0) throw new HttpError(404, 'Receptet finns inte.');
      db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id);
    }

    const insert = db.prepare(
      'INSERT INTO recipe_ingredients (recipe_id, position, name, amount, unit, note) VALUES (?, ?, ?, ?, ?, ?)',
    );
    // En föreslagen avdelning (från AI-importen) sparas bara om varan inte redan har en.
    const learn = db.prepare('INSERT OR IGNORE INTO ingredient_categories (key, category) VALUES (?, ?)');
    recipe.ingredients.forEach((ing, position) => {
      insert.run(id, position, ing.name, ing.amount, ing.unit, ing.note);
      if (ing.category) learn.run(nameKey(ing.name), ing.category);
    });
    return id;
  });
}

/** Ändrar bara hur många portioner receptet räknas som – mängderna står kvar. */
export function setRecipeServings(db, id, servings) {
  const result = db
    .prepare("UPDATE recipes SET servings = ?, updated_at = datetime('now') WHERE id = ?")
    .run(servings, id);
  if (result.changes === 0) throw new HttpError(404, 'Receptet finns inte.');
}

export function deleteRecipe(db, id) {
  const result = db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  if (result.changes === 0) throw new HttpError(404, 'Receptet finns inte.');
}

/** Alla ingrediensnamn som förekommer i receptdatabasen, ett per vara. */
export function listIngredientNames(db) {
  const seen = new Map();
  for (const row of db.prepare('SELECT name FROM recipe_ingredients ORDER BY id DESC').all()) {
    const key = nameKey(row.name);
    if (key && !seen.has(key)) seen.set(key, row.name.trim());
  }
  return [...seen.values()].sort(sv.compare);
}
