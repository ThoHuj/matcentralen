import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  servings REAL NOT NULL,
  source_url TEXT,
  instructions TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  amount REAL,
  unit TEXT,
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

-- Recept som är valda till den aktuella inköpslistan.
CREATE TABLE IF NOT EXISTS plan_recipes (
  recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
  servings REAL NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Enskilda varor som lagts till för hand.
CREATE TABLE IF NOT EXISTS manual_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount REAL,
  unit TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Avprickning och "har hemma" per vara på listan. have är JSON: { dimension: mängd i basenhet }.
CREATE TABLE IF NOT EXISTS item_state (
  key TEXT PRIMARY KEY,
  checked INTEGER NOT NULL DEFAULT 0,
  have TEXT NOT NULL DEFAULT '{}'
);

-- Inlärd butiksavdelning per vara.
CREATE TABLE IF NOT EXISTS ingredient_categories (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL
);
`;

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

/** Kör fn i en transaktion. */
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
