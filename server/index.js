import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, openDb } from './db.js';
import { CATEGORIES } from './categories.js';
import { importRecipe } from './importer.js';
import {
  addManualItem,
  buildList,
  clearList,
  removeManualItem,
  removePlanRecipe,
  setCategory,
  setItemState,
  setPlanRecipe,
} from './list.js';
import {
  deleteRecipe,
  getRecipe,
  listIngredientNames,
  listRecipes,
  parseRecipe,
  parseServings,
  saveRecipe,
  setRecipeServings,
} from './recipes.js';
import { parseWebhookUrl, sendSuggestion } from './suggestions.js';
import { UNITS } from './units.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 3000;
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const distDir = path.join(root, 'dist');

const ai = {
  apiKey: (process.env.OPENROUTER_API_KEY ?? '').trim(),
  model: (process.env.OPENROUTER_MODEL ?? '').trim() || 'anthropic/claude-sonnet-5.5',
};

const suggestionWebhook = parseWebhookUrl(process.env.DISCORD_WEBHOOK_URL);

fs.mkdirSync(dataDir, { recursive: true });
const db = openDb(path.join(dataDir, 'matcentralen.db'));

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// --- Liveuppdateringar -------------------------------------------------------
// Alla öppna webbläsare får veta när något ändras, så att två personer kan
// pricka av samma lista samtidigt.

const listeners = new Set();

function broadcast(...topics) {
  for (const res of listeners) {
    for (const topic of topics) res.write(`data: ${topic}\n\n`);
  }
}

app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  listeners.add(res);
  req.on('close', () => listeners.delete(res));
});

const heartbeat = setInterval(() => {
  for (const res of listeners) res.write(': ping\n\n');
}, 25_000);

// --- Hjälpare ----------------------------------------------------------------

function idParam(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Ogiltigt id.');
  return id;
}

// --- Grunddata ---------------------------------------------------------------

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/config', (req, res) => {
  res.json({
    aiEnabled: Boolean(ai.apiKey),
    model: ai.model,
    suggestionsEnabled: Boolean(suggestionWebhook),
    categories: CATEGORIES,
    units: UNITS,
  });
});

// --- Recept ------------------------------------------------------------------

app.get('/api/recipes', (req, res) => res.json(listRecipes(db)));

app.get('/api/recipes/:id', (req, res) => res.json(getRecipe(db, idParam(req))));

app.post('/api/recipes', (req, res) => {
  const id = saveRecipe(db, null, parseRecipe(req.body));
  broadcast('recipes');
  res.status(201).json(getRecipe(db, id));
});

app.put('/api/recipes/:id', (req, res) => {
  const id = saveRecipe(db, idParam(req), parseRecipe(req.body));
  broadcast('recipes', 'list');
  res.json(getRecipe(db, id));
});

app.patch('/api/recipes/:id/servings', (req, res) => {
  const id = idParam(req);
  setRecipeServings(db, id, parseServings(req.body?.servings));
  broadcast('recipes', 'list');
  res.json(getRecipe(db, id));
});

app.delete('/api/recipes/:id', (req, res) => {
  deleteRecipe(db, idParam(req));
  broadcast('recipes', 'list');
  res.status(204).end();
});

app.get('/api/ingredients', (req, res) => res.json(listIngredientNames(db)));

app.post('/api/import', async (req, res) => {
  const draft = await importRecipe(ai, req.body ?? {}, listIngredientNames(db));
  res.json(draft);
});

// --- Förslagslåda ------------------------------------------------------------

app.post('/api/suggestions', async (req, res) => {
  await sendSuggestion(suggestionWebhook, req.body);
  res.status(204).end();
});

// --- Inköpslista -------------------------------------------------------------
// Varje ändring svarar med hela den uppdaterade listan.

function listChanged(res) {
  broadcast('list', 'recipes');
  res.json(buildList(db));
}

app.get('/api/list', (req, res) => res.json(buildList(db)));

app.put('/api/list/recipes/:id', (req, res) => {
  setPlanRecipe(db, idParam(req), parseServings(req.body?.servings));
  listChanged(res);
});

app.delete('/api/list/recipes/:id', (req, res) => {
  removePlanRecipe(db, idParam(req));
  listChanged(res);
});

app.post('/api/list/items', (req, res) => {
  addManualItem(db, req.body?.text);
  listChanged(res);
});

app.delete('/api/list/items/:id', (req, res) => {
  removeManualItem(db, idParam(req));
  listChanged(res);
});

app.post('/api/list/state', (req, res) => {
  setItemState(db, req.body ?? {});
  listChanged(res);
});

app.post('/api/list/category', (req, res) => {
  setCategory(db, req.body?.key, req.body?.category);
  listChanged(res);
});

app.post('/api/list/clear', (req, res) => {
  clearList(db);
  listChanged(res);
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Finns inte.' }));

// --- Webbgränssnittet --------------------------------------------------------

if (fs.existsSync(distDir)) {
  app.use(
    express.static(distDir, {
      setHeaders(res, file) {
        const hashed = file.includes(`${path.sep}assets${path.sep}`);
        res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    }),
  );
}

// --- Felhantering ------------------------------------------------------------

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Ogiltig JSON.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'För mycket data.' });
  console.error(err);
  res.status(500).json({ error: 'Något gick fel på servern.' });
});

const server = app.listen(port, () => {
  console.log(`Matcentralen lyssnar på port ${port}`);
  console.log(ai.apiKey ? `AI-import: på (${ai.model})` : 'AI-import: av (OPENROUTER_API_KEY saknas)');
  console.log(suggestionWebhook ? 'Förslagslåda: på' : 'Förslagslåda: av (DISCORD_WEBHOOK_URL saknas)');
});

function shutdown() {
  clearInterval(heartbeat);
  for (const res of listeners) res.end();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
