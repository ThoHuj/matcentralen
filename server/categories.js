// Butiksavdelningar, i den ordning man brukar gå genom butiken.
export const CATEGORIES = [
  'Frukt & grönt',
  'Bröd',
  'Mejeri & ägg',
  'Kött & chark',
  'Fisk & skaldjur',
  'Skafferi',
  'Kryddor & såser',
  'Fryst',
  'Dryck',
  'Hushåll',
  'Övrigt',
];

export const DEFAULT_CATEGORY = 'Övrigt';

// Fraser som matchas var som helst i namnet. Kontrolleras först eftersom de
// fångar sammansättningar där huvudordet annars skulle leda fel
// ("kokosmjölk" är inte mejeri, "krossade tomater" är inte grönt).
const PHRASES = [
  ['Fryst', ['fryst', 'frysta', 'glass']],
  ['Skafferi', [
    'kokosmjölk', 'kokosgrädde', 'krossade tomater', 'passerade tomater', 'hela tomater',
    'soltorkade', 'jordnötssmör', 'mandelmjöl', 'potatismjöl', 'vetemjöl', 'rågmjöl', 'dinkelmjöl',
    'majsstärkelse', 'ströbröd', 'på burk', 'torkad', 'torkade',
  ]],
  ['Kryddor & såser', ['tomatpuré', 'sweet chili', 'chili flakes', 'svartpeppar', 'vitpeppar']],
  ['Mejeri & ägg', ['crème fraiche', 'creme fraiche', 'keso', 'kvarg', 'cream cheese']],
  ['Bröd', ['tortilla', 'pitabröd', 'hamburgerbröd', 'korvbröd']],
];

// Ord som matchas mot slutet av varje ord i namnet. Svenska sammansättningar
// har huvudordet sist, så "körsbärstomater" hamnar rätt via "tomater".
// Korta ord som annars ger falska träffar ("mjöl" slutar på "öl") skrivs med
// "=" framför och måste då matcha hela ordet.
const WORDS = [
  ['Kryddor & såser', [
    'salt', 'peppar', 'pulver', 'krydda', 'kryddor', 'kryddmix', 'oregano', 'kanel', 'kummin',
    'spiskummin', 'curry', 'gurkmeja', 'kardemumma', 'vanilj', 'vaniljsocker', 'lagerblad',
    'chiliflakes', 'cayenne', 'muskot', 'buljong', 'buljongtärning', 'fond', 'soja', 'ketchup',
    'senap', 'majonnäs', 'vinäger', 'sambal', 'sriracha', 'tabasco', 'fisksås', 'ostronsås',
    'pesto', 'sås', 'puré', 'olja', 'balsamico',
  ]],
  ['Frukt & grönt', [
    'lök', 'lökar', 'vitlök', 'vitlöksklyfta', 'vitlöksklyftor', 'schalottenlök', 'purjolök',
    'salladslök', 'tomat', 'tomater', 'gurka', 'gurkor', 'paprika', 'paprikor', 'morot', 'morötter',
    'potatis', 'potatisar', 'sötpotatis', 'sallad', 'spenat', 'ruccola', 'kål', 'broccoli',
    'zucchini', 'squash', 'aubergine', 'svamp', 'champinjoner', 'champinjon', 'kantareller',
    'avokado', 'avokador', 'citron', 'citroner', 'lime', 'apelsin', 'apelsiner', 'äpple', 'äpplen',
    'banan', 'bananer', 'päron', 'bär', 'jordgubbar', 'blåbär', 'hallon', 'ingefära', 'chili',
    'persilja', 'basilika', 'koriander', 'dill', 'gräslök', 'mynta', 'timjan', 'rosmarin',
    'selleri', 'rödbeta', 'rödbetor', 'palsternacka', 'majs', 'sparris', 'rädisor', 'fänkål',
    'mango', 'ananas', 'vindruvor', 'melon', 'granatäpple', 'böngroddar', 'sockerärtor',
  ]],
  ['Mejeri & ägg', [
    'mjölk', 'grädde', 'vispgrädde', 'matlagningsgrädde', 'smör', 'margarin', 'ost', 'yoghurt',
    '=fil', 'filmjölk', 'ägg', 'äggula', 'äggulor', 'äggvita', 'äggvitor', 'gräddfil', 'halloumi',
    'mozzarella', 'parmesan', 'fetaost', 'ricotta', 'mascarpone', 'färskost',
  ]],
  ['Fisk & skaldjur', [
    'lax', 'laxfilé', 'torsk', 'torskrygg', 'sej', 'fisk', 'räkor', 'räka', 'tonfisk', 'sill',
    'makrill', 'musslor', 'torskfilé', 'sejfilé', 'fiskfilé', 'kräftstjärtar', 'kaviar', 'rödspätta', 'ansjovis',
  ]],
  ['Kött & chark', [
    'kött', 'köttfärs', 'nötfärs', 'fläskfärs', 'blandfärs', 'färs', 'kyckling', 'kycklingfilé',
    'kycklinglårfilé', 'bacon', 'fläsk', 'fläskfilé', 'karré', 'kotlett', 'kotletter', 'korv',
    'skinka', 'salami', 'chorizo', 'biff', 'entrecôte', 'högrev', 'lamm', 'kalkon', 'filé',
    'köttbullar', 'sidfläsk', 'pancetta', 'prosciutto',
  ]],
  ['Bröd', ['bröd', 'baguette', 'fralla', 'frallor', 'knäckebröd', 'limpa', 'kavring']],
  ['Dryck', [
    'juice', 'läsk', '=vin', 'vitvin', 'rödvin', 'matlagningsvin', '=öl', 'lättöl', 'kaffe', '=te',
    'saft', 'vatten', 'cider',
  ]],
  ['Hushåll', [
    'diskmedel', 'tvättmedel', 'toalettpapper', 'hushållspapper', 'soppåsar', 'bakplåtspapper',
    'folie', 'tandkräm', 'tvål', 'schampo', 'sköljmedel', 'disktabletter', 'servetter',
  ]],
  ['Skafferi', [
    'mjöl', 'socker', 'florsocker', 'strösocker', 'farinsocker', 'ris', 'pasta', 'spaghetti',
    'makaroner', 'penne', 'lasagneplattor', 'nudlar', 'couscous', 'bulgur', 'quinoa', 'linser',
    'bönor', 'kikärtor', 'havregryn', 'müsli', 'flingor', 'jäst', 'bakpulver', 'bikarbonat',
    'kakao', 'choklad', 'nötter', 'mandel', 'mandlar', 'cashewnötter', 'valnötter', 'pinjenötter',
    'frön', 'sesamfrön', 'russin', 'oliver', 'kapris', 'sylt', 'marmelad', 'tacoskal', 'chips',
    'gelatin', 'gelatinblad', 'kex', 'tofu', 'majskorn', 'honung', 'sirap',
  ]],
];

function matches(word, ending) {
  return ending.startsWith('=') ? word === ending.slice(1) : word.endsWith(ending);
}

/** Gissar butiksavdelning utifrån varans namn. */
export function guessCategory(name) {
  const key = String(name ?? '').trim().toLowerCase();
  if (!key) return DEFAULT_CATEGORY;
  for (const [category, phrases] of PHRASES) {
    if (phrases.some((phrase) => key.includes(phrase))) return category;
  }
  const words = key.split(/[\s,()/-]+/).filter(Boolean);
  for (const [category, endings] of WORDS) {
    if (words.some((word) => endings.some((ending) => matches(word, ending)))) return category;
  }
  return DEFAULT_CATEGORY;
}
