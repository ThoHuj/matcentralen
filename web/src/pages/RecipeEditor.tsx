import { useEffect, useState, type FormEvent } from 'react';
import { api, type Config, type Ingredient, type RecipeInput } from '../api';
import { errorMessage, parseAmount } from '../format';
import { navigate } from '../hooks';
import { ErrorBanner } from '../ui';

interface Row {
  id: number;
  amount: string;
  unit: string;
  name: string;
  note: string;
  category?: string;
}

interface Form {
  name: string;
  servings: string;
  sourceUrl: string;
  instructions: string;
  notes: string;
  rows: Row[];
}

let nextRowId = 1;
const emptyRow = (): Row => ({ id: nextRowId++, amount: '', unit: '', name: '', note: '' });

const decimal = (n: number) => String(n).replace('.', ',');

function toForm(recipe: RecipeInput): Form {
  return {
    name: recipe.name,
    servings: decimal(recipe.servings),
    sourceUrl: recipe.sourceUrl ?? '',
    instructions: recipe.instructions,
    notes: recipe.notes,
    rows: recipe.ingredients.map((ing) => ({
      id: nextRowId++,
      amount: ing.amount == null ? '' : decimal(ing.amount),
      unit: ing.unit ?? '',
      name: ing.name,
      note: ing.note,
      category: ing.category,
    })),
  };
}

const emptyForm = (): Form => ({
  name: '',
  servings: '4',
  sourceUrl: '',
  instructions: '',
  notes: '',
  rows: [emptyRow(), emptyRow(), emptyRow()],
});

/** Gör om formuläret till ett recept, eller kastar ett fel som förklarar vad som saknas. */
function toRecipe(form: Form): RecipeInput {
  if (!form.name.trim()) throw new Error('Ge receptet ett namn.');
  const servings = parseAmount(form.servings);
  if (typeof servings !== 'number') throw new Error('Ange hur många portioner receptet ger.');

  const ingredients: Ingredient[] = [];
  for (const row of form.rows) {
    const name = row.name.trim();
    const amount = parseAmount(row.amount);
    if (!name && amount === null && !row.note.trim()) continue; // helt tom rad
    if (!name) throw new Error('En ingrediensrad saknar namn.');
    if (amount === undefined) throw new Error(`Mängden för ${name} går inte att tolka.`);
    ingredients.push({
      name,
      amount,
      unit: amount === null ? null : row.unit || 'st',
      note: row.note.trim(),
      category: row.category,
    });
  }
  if (ingredients.length === 0) throw new Error('Lägg till minst en ingrediens.');

  return {
    name: form.name.trim(),
    servings,
    sourceUrl: form.sourceUrl.trim() || null,
    instructions: form.instructions.trim(),
    notes: form.notes.trim(),
    ingredients,
  };
}

export function RecipeEditor({ id, config }: { id: number | null; config: Config }) {
  const [form, setForm] = useState<Form | null>(id == null ? emptyForm : null);
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [imported, setImported] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.ingredientNames().then(setNames).catch(() => {});
    if (id != null) {
      api
        .recipe(id)
        .then((recipe) => setForm(toForm(recipe)))
        .catch((err) => setError(errorMessage(err)));
    }
  }, [id]);

  if (!form) {
    return error ? <ErrorBanner message={error} /> : <p className="muted">Hämtar receptet…</p>;
  }

  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const setRow = (rowId: number, patch: Partial<Row>) =>
    set({ rows: form.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const recipe = toRecipe(form);
      const saved = id == null ? await api.createRecipe(recipe) : await api.updateRecipe(id, recipe);
      navigate(`/recept/${saved.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  const back = id == null ? '#/recept' : `#/recept/${id}`;

  return (
    <div className="stack">
      <a className="back" href={back}>
        ‹ Tillbaka
      </a>
      <h1>{id == null ? 'Nytt recept' : 'Redigera recept'}</h1>

      {id == null && (
        <ImportPanel
          config={config}
          onDraft={(draft) => {
            setForm(toForm(draft));
            setImported(true);
            setError('');
          }}
        />
      )}

      {imported && (
        <div className="banner banner-ok" role="status">
          Receptet är inläst. Titta igenom uppgifterna och spara.
        </div>
      )}

      <form className="card stack" onSubmit={save}>
        <div className="field-row">
          <label className="field field-grow">
            <span>Namn</span>
            <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
          </label>
          <label className="field field-narrow">
            <span>Portioner</span>
            <input
              className="input"
              inputMode="decimal"
              value={form.servings}
              onChange={(e) => set({ servings: e.target.value })}
              required
            />
          </label>
        </div>

        <fieldset className="ing-editor">
          <legend>Ingredienser</legend>
          <div className="ing-rows">
            {form.rows.map((row) => (
              <div className="ing-row" key={row.id}>
                <input
                  className="input"
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(e) => setRow(row.id, { amount: e.target.value })}
                  placeholder="Mängd"
                  aria-label="Mängd"
                />
                <select
                  className="select"
                  value={row.unit}
                  onChange={(e) => setRow(row.id, { unit: e.target.value })}
                  aria-label="Enhet"
                >
                  <option value="">–</option>
                  {units(config.units, row.unit).map((unit) => (
                    <option key={unit}>{unit}</option>
                  ))}
                </select>
                <input
                  className="input ing-name"
                  list="ingredient-names"
                  value={row.name}
                  onChange={(e) => setRow(row.id, { name: e.target.value, category: undefined })}
                  placeholder="Ingrediens"
                  aria-label="Ingrediens"
                />
                <input
                  className="input ing-note"
                  value={row.note}
                  onChange={(e) => setRow(row.id, { note: e.target.value })}
                  placeholder="t.ex. finhackad"
                  aria-label="Anteckning"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm ing-del"
                  onClick={() => set({ rows: form.rows.filter((other) => other.id !== row.id) })}
                  aria-label={`Ta bort ${row.name || 'raden'}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <datalist id="ingredient-names">
            {names.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <button type="button" className="btn btn-sm" onClick={() => set({ rows: [...form.rows, emptyRow()] })}>
            + Ingrediens
          </button>
        </fieldset>

        <label className="field">
          <span>Gör så här</span>
          <textarea
            className="input"
            rows={8}
            value={form.instructions}
            onChange={(e) => set({ instructions: e.target.value })}
            placeholder="Ett steg per rad"
          />
        </label>

        <label className="field">
          <span>Anteckningar</span>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>

        <label className="field">
          <span>Länk till receptet</span>
          <input
            className="input"
            type="url"
            value={form.sourceUrl}
            onChange={(e) => set({ sourceUrl: e.target.value })}
            placeholder="https://"
          />
        </label>

        <ErrorBanner message={error} />

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Sparar…' : 'Spara recept'}
          </button>
          <a className="btn btn-ghost" href={back}>
            Avbryt
          </a>
        </div>
      </form>
    </div>
  );
}

/** Enhetslistan, plus radens egen enhet om den är ovanlig (t.ex. från en import). */
function units(standard: string[], current: string): string[] {
  return current && !standard.includes(current) ? [...standard, current] : standard;
}

interface ImportPanelProps {
  config: Config;
  onDraft: (draft: RecipeInput) => void;
}

function ImportPanel({ config, onDraft }: ImportPanelProps) {
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!config.aiEnabled) {
    return (
      <div className="card muted small">
        AI-import är inte påslagen. Lägg in en OpenRouter-nyckel som <code>OPENROUTER_API_KEY</code> i <code>.env</code>{' '}
        och starta om för att kunna läsa in recept från en länk.
      </div>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDraft(await api.importRecipe(mode === 'url' ? { url } : { text }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack import" onSubmit={submit}>
      <div className="section-head">
        <h2>Läs in med AI</h2>
        <div className="seg" role="group" aria-label="Källa">
          <button type="button" aria-pressed={mode === 'url'} onClick={() => setMode('url')}>
            Länk
          </button>
          <button type="button" aria-pressed={mode === 'text'} onClick={() => setMode('text')}>
            Text
          </button>
        </div>
      </div>

      {mode === 'url' ? (
        <input
          className="input"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Klistra in länken till receptet"
          aria-label="Länk till receptet"
          required
        />
      ) : (
        <textarea
          className="input"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Klistra in receptets text – bra när en sida inte går att hämta"
          aria-label="Receptets text"
          required
        />
      )}

      <ErrorBanner message={error} />

      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Läser receptet…' : 'Läs in recept'}
        </button>
        {busy && <span className="muted small">Det brukar ta 10–30 sekunder.</span>}
      </div>
    </form>
  );
}
