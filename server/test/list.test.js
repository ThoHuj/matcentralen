import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guessCategory } from '../categories.js';
import { openDb } from '../db.js';
import { extractJsonLdRecipes, htmlToText, normalizeDraft } from '../importer.js';
import { addManualItem, buildList, clearList, setCategory, setItemState, setPlanRecipe } from '../list.js';
import { parseRecipe, saveRecipe, setRecipeServings } from '../recipes.js';
import { buildSuggestionMessage, parseWebhookUrl } from '../suggestions.js';
import { formatAmount, formatNumber, parseQuickItem, toBase } from '../units.js';

function recipe(name, servings, ingredients) {
  return parseRecipe({
    name,
    servings,
    ingredients: ingredients.map(([ingredient, amount, unit]) => ({ name: ingredient, amount, unit })),
  });
}

const item = (list, key) => list.items.find((entry) => entry.key === key);

test('mått räknas om och visas i läsbar enhet', () => {
  assert.deepEqual(toBase(2, 'dl'), { dim: 'v', base: 200 });
  assert.deepEqual(toBase(1.5, 'Kilo'), { dim: 'w', base: 1500 });
  assert.deepEqual(toBase(3, null), { dim: 'u:st', base: 3 });
  assert.equal(toBase(null, 'g'), null);
  assert.equal(formatAmount(1500, 'w').text, '1,5 kg');
  assert.equal(formatAmount(450, 'w').text, '450 g');
  assert.equal(formatAmount(45, 'v').text, '3 msk');
  assert.equal(formatAmount(50, 'v').text, '0,5 dl');
  assert.equal(formatAmount(250, 'v').text, '2,5 dl');
  assert.equal(formatAmount(1250, 'v').text, '1,25 l');
  assert.equal(formatAmount(10, 'v').text, '2 tsk');
  assert.equal(formatAmount(2, 'v').text, '2 krm');
  assert.equal(formatAmount(2.5, 'u:burk').text, '2,5 burk');
  assert.equal(formatNumber(2 / 3), '0,67');
});

test('fritext tolkas till vara, mängd och enhet', () => {
  assert.deepEqual(parseQuickItem('2 l mjölk'), { name: 'mjölk', amount: 2, unit: 'l' });
  assert.deepEqual(parseQuickItem('500g köttfärs'), { name: 'köttfärs', amount: 500, unit: 'g' });
  assert.deepEqual(parseQuickItem('2 röda paprikor'), { name: 'röda paprikor', amount: 2, unit: 'st' });
  assert.deepEqual(parseQuickItem('mjölk 1,5 liter'), { name: 'mjölk', amount: 1.5, unit: 'l' });
  assert.deepEqual(parseQuickItem('ägg 12'), { name: 'ägg', amount: 12, unit: 'st' });
  assert.deepEqual(parseQuickItem('diskmedel'), { name: 'diskmedel', amount: null, unit: null });
  assert.equal(parseQuickItem('   '), null);
});

test('samma vara i flera recept summeras och skalas efter portioner', () => {
  const db = openDb(':memory:');
  const lasagne = saveRecipe(db, null, recipe('Lasagne', 4, [['Gul lök', 2, 'st'], ['mjölk', 5, 'dl'], ['salt']]));
  const pannkakor = saveRecipe(db, null, recipe('Pannkakor', 4, [['mjölk', 6, 'dl'], ['gul lök', 100, 'g']]));
  setPlanRecipe(db, lasagne, 8); // dubbel sats
  setPlanRecipe(db, pannkakor, 2); // halv sats
  addManualItem(db, '1 l mjölk');

  const list = buildList(db);
  assert.equal(list.recipes.length, 2);

  const milk = item(list, 'mjölk');
  assert.equal(milk.parts.length, 1);
  assert.equal(milk.parts[0].need, 1000 + 300 + 1000);
  assert.equal(milk.parts[0].needText, '2,3 l');
  assert.equal(milk.sources.length, 3);
  assert.equal(milk.category, 'Mejeri & ägg');

  // Styck och gram går inte att lägga ihop, så varan får två delmängder på samma rad.
  const onion = item(list, 'gul lök');
  assert.deepEqual(onion.parts.map((part) => [part.dim, part.need]), [['w', 50], ['u:st', 4]]);

  const salt = item(list, 'salt');
  assert.equal(salt.unspecified, true);
  assert.equal(salt.parts.length, 0);
});

test('det man har hemma dras av och täcker till slut hela behovet', () => {
  const db = openDb(':memory:');
  const id = saveRecipe(db, null, recipe('Bröd', 1, [['vetemjöl', 1, 'kg']]));
  setPlanRecipe(db, id, 1);

  setItemState(db, { key: 'Vetemjöl', have: [{ dim: 'w', amount: 400, unit: 'g' }] });
  let flour = item(buildList(db), 'vetemjöl');
  assert.equal(flour.parts[0].buyText, '600 g');
  assert.equal(flour.done, false);

  setItemState(db, { key: 'vetemjöl', have: [{ dim: 'w', amount: 1.2, unit: 'kg' }] });
  flour = item(buildList(db), 'vetemjöl');
  assert.equal(flour.covered, true);
  assert.equal(flour.done, true);

  setItemState(db, { key: 'vetemjöl', have: [{ dim: 'w', amount: 0 }] });
  setItemState(db, { key: 'vetemjöl', checked: true });
  flour = item(buildList(db), 'vetemjöl');
  assert.equal(flour.covered, false);
  assert.equal(flour.checked, true);

  assert.throws(() => setItemState(db, { key: 'vetemjöl', have: [{ dim: 'w', amount: 2, unit: 'dl' }] }));

  clearList(db);
  assert.deepEqual(buildList(db), { recipes: [], items: [] });
});

test('justerat portionsantal ändrar hur mycket som går åt per portion', () => {
  const db = openDb(':memory:');
  const id = saveRecipe(db, null, recipe('Gryta', 4, [['potatis', 800, 'g']]));
  setPlanRecipe(db, id, 4);
  assert.equal(item(buildList(db), 'potatis').parts[0].need, 800);

  // Receptet visade sig räcka till 6 portioner: fyra portioner kräver då mindre.
  setRecipeServings(db, id, 6);
  assert.equal(item(buildList(db), 'potatis').parts[0].need, 533.333);
});

test('avdelning gissas och kan läras om', () => {
  assert.equal(guessCategory('körsbärstomater'), 'Frukt & grönt');
  assert.equal(guessCategory('krossade tomater'), 'Skafferi');
  assert.equal(guessCategory('kokosmjölk'), 'Skafferi');
  assert.equal(guessCategory('vetemjöl'), 'Skafferi');
  assert.equal(guessCategory('laxfilé'), 'Fisk & skaldjur');
  assert.equal(guessCategory('kycklingbuljong'), 'Kryddor & såser');
  assert.equal(guessCategory('osaltat smör'), 'Mejeri & ägg');
  assert.equal(guessCategory('glitter'), 'Övrigt');

  const db = openDb(':memory:');
  addManualItem(db, 'glitter');
  setCategory(db, 'Glitter', 'Hushåll');
  assert.equal(item(buildList(db), 'glitter').category, 'Hushåll');
});

test('receptdata plockas ur en webbsida', () => {
  const html = `<html><head><script type="application/ld+json">
    {"@graph":[{"@type":"WebPage"},{"@type":["Recipe"],"name":"K&ouml;ttbullar","recipeYield":"4",
    "recipeIngredient":["500 g färs"],"recipeInstructions":[{"@type":"HowToStep","text":"Rulla."}]}]}
    </script><style>p{}</style></head><body><p>Hej&nbsp;d&aring;</p><script>x()</script><li>500 g f&#228;rs</li></body></html>`;
  const [found] = extractJsonLdRecipes(html);
  assert.deepEqual(found.recipeIngredient, ['500 g färs']);
  assert.deepEqual(found.recipeInstructions, ['Rulla.']);
  assert.equal(htmlToText(html), 'Hej då\n500 g färs');
});

test('modellens svar städas till ett utkast', () => {
  const draft = normalizeDraft(
    {
      found: true,
      name: ' Köttbullar ',
      servings: 4,
      ingredients: [
        { name: 'nötfärs', amount: 500, unit: 'gram', note: '', category: 'Kött & chark' },
        { name: 'salt', amount: null, unit: 'tsk', note: '', category: 'påhittad' },
        { name: 'ägg', amount: 1, unit: null, note: '' },
      ],
      instructions: ['1. Blanda.', 'Stek.'],
      notes: '',
    },
    'https://example.com/recept',
  );
  assert.equal(draft.name, 'Köttbullar');
  assert.deepEqual(draft.ingredients[0], { name: 'nötfärs', amount: 500, unit: 'g', note: '', category: 'Kött & chark' });
  assert.deepEqual(draft.ingredients[1], { name: 'salt', amount: null, unit: null, note: '', category: 'Kryddor & såser' });
  assert.equal(draft.ingredients[2].unit, 'st');
  assert.equal(draft.instructions, '1. Blanda.\n2. Stek.');
  assert.throws(() => normalizeDraft({ found: false, ingredients: [] }, null));
});

test('förslag blir ett Discord-meddelande som inte kan pinga någon', () => {
  const message = buildSuggestionMessage(
    { text: '  @everyone Större knappar tack  ', name: '', page: '/recept/`3`', theme: 'Rolig, mörkt', screen: '' },
    new Date('2026-11-10T12:00:00Z'),
  );
  assert.deepEqual(message.allowed_mentions, { parse: [] });
  const [embed] = message.embeds;
  assert.equal(embed.description, '@everyone Större knappar tack');
  assert.equal(embed.timestamp, '2026-11-10T12:00:00.000Z');
  // Tomma fält utelämnas – Discord avvisar dem annars.
  assert.deepEqual(
    embed.fields.map((field) => [field.name, field.value]),
    [['Från', 'Anonym'], ['Sida', '`/recept/3`'], ['Utseende', 'Rolig, mörkt']],
  );
  assert.throws(() => buildSuggestionMessage({ text: '   ' }));

  assert.equal(parseWebhookUrl(' https://discord.com/api/webhooks/123/abc-DEF_1 '), 'https://discord.com/api/webhooks/123/abc-DEF_1');
  assert.equal(parseWebhookUrl(''), '');
});
