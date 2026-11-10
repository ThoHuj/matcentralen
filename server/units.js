// Svenska mått. Vikt räknas om till gram och volym till milliliter så att
// samma ingrediens kan summeras över flera recept. Allt annat (st, burk,
// klyfta ...) summeras bara med sig självt.

const WEIGHT = { g: 1, hg: 100, kg: 1000 };
const VOLUME = { krm: 1, tsk: 5, msk: 15, ml: 1, cl: 10, dl: 100, l: 1000 };

export const COUNT_UNITS = [
  'st', 'förp', 'burk', 'klyfta', 'kruka', 'knippe', 'skiva', 'nypa', 'påse', 'flaska', 'kvist',
];

/** Enheter som erbjuds i gränssnittet. */
export const UNITS = ['g', 'kg', 'ml', 'cl', 'dl', 'l', 'krm', 'tsk', 'msk', ...COUNT_UNITS];

const SYNONYMS = new Map(
  Object.entries({
    gram: 'g', gr: 'g', hekto: 'hg', kilo: 'kg', kilogram: 'kg',
    milliliter: 'ml', centiliter: 'cl', deciliter: 'dl', liter: 'l', lit: 'l',
    kryddmått: 'krm', tesked: 'tsk', teskedar: 'tsk', matsked: 'msk', matskedar: 'msk',
    styck: 'st', stycken: 'st', stk: 'st',
    förpackning: 'förp', förpackningar: 'förp', paket: 'förp', pkt: 'förp', pak: 'förp',
    burkar: 'burk', klyftor: 'klyfta', krukor: 'kruka', knippen: 'knippe', skivor: 'skiva',
    nypor: 'nypa', påsar: 'påse', flaskor: 'flaska', kvistar: 'kvist',
  }),
);

const KNOWN = new Set([...Object.keys(WEIGHT), ...Object.keys(VOLUME), ...COUNT_UNITS]);

export function normalizeUnit(raw) {
  if (raw == null) return null;
  const unit = String(raw).trim().toLowerCase().replace(/\.$/, '').slice(0, 20);
  if (!unit) return null;
  return SYNONYMS.get(unit) ?? unit;
}

export function isKnownUnit(raw) {
  const unit = normalizeUnit(raw);
  return unit != null && KNOWN.has(unit);
}

/** Nyckeln som avgör om två ingredienser är "samma vara". */
export function nameKey(name) {
  return String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Räknar om en mängd till basenhet. Dimensionen är 'w' (vikt, gram),
 * 'v' (volym, ml) eller 'u:<enhet>' för styckmått. Null om mängd saknas.
 */
export function toBase(amount, unit) {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  const u = normalizeUnit(unit) ?? 'st';
  if (u in WEIGHT) return { dim: 'w', base: amount * WEIGHT[u] };
  if (u in VOLUME) return { dim: 'v', base: amount * VOLUME[u] };
  return { dim: `u:${u}`, base: amount };
}

/** Svensk talformatering: decimalkomma och lagom många decimaler. */
export function formatNumber(n) {
  const abs = Math.abs(n);
  const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return String(Number(n.toFixed(decimals))).replace('.', ',');
}

const isHalfStep = (x) => Math.abs(x * 2 - Math.round(x * 2)) < 1e-6;

function volumeUnit(ml) {
  if (ml >= 1000) return 'l';
  if (ml >= 100) return 'dl';
  if (ml >= 15) {
    if (isHalfStep(ml / 15)) return 'msk';
    return ml >= 50 || isHalfStep(ml / 50) ? 'dl' : 'msk';
  }
  if (isHalfStep(ml / 5)) return 'tsk';
  return ml < 5 ? 'krm' : 'tsk';
}

/** Väljer en läsbar enhet för en mängd i basenhet. */
export function formatAmount(base, dim) {
  let unit;
  let amount;
  if (dim === 'w') {
    unit = base >= 1000 ? 'kg' : 'g';
    amount = base / WEIGHT[unit];
  } else if (dim === 'v') {
    unit = volumeUnit(base);
    amount = base / VOLUME[unit];
  } else {
    unit = dim.slice(2);
    amount = base;
  }
  return { amount, unit, text: `${formatNumber(amount)} ${unit}` };
}

/** Enheter som går att välja när man anger hur mycket man har hemma. */
export function unitsForDim(dim) {
  if (dim === 'w') return ['g', 'kg'];
  if (dim === 'v') return ['krm', 'tsk', 'msk', 'ml', 'dl', 'l'];
  return [dim.slice(2)];
}

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;

function toNumber(text) {
  return Number(text.replace(',', '.'));
}

/**
 * Tolkar fritext som "2 l mjölk", "500g köttfärs", "mjölk 2 l" eller bara
 * "diskmedel" till { name, amount, unit }.
 */
export function parseQuickItem(text) {
  const input = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (!input) return null;

  const leading = input.match(new RegExp(`^(${NUMBER})\\s*(.+)$`));
  if (leading) {
    const amount = toNumber(leading[1]);
    const [first, ...rest] = leading[2].split(' ');
    if (rest.length > 0 && isKnownUnit(first)) {
      return { name: rest.join(' '), amount, unit: normalizeUnit(first) };
    }
    return { name: leading[2], amount, unit: 'st' };
  }

  const trailing = input.match(new RegExp(`^(.+?) (${NUMBER})\\s*(\\S+)?$`));
  if (trailing && (trailing[3] == null || isKnownUnit(trailing[3]))) {
    return {
      name: trailing[1],
      amount: toNumber(trailing[2]),
      unit: normalizeUnit(trailing[3]) ?? 'st',
    };
  }

  return { name: input, amount: null, unit: null };
}
