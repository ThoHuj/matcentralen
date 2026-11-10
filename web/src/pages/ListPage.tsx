import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, type Config, type HaveChange, type ListItem, type ListPart, type RecipeSummary, type ShoppingList } from '../api';
import { errorMessage, formatNumber, parseAmount } from '../format';
import { useLive } from '../hooks';
import { ErrorBanner, Modal, Stepper } from '../ui';

const CATEGORY_EMOJI: Record<string, string> = {
  'Frukt & grönt': '🥕',
  Bröd: '🥖',
  'Mejeri & ägg': '🧀',
  'Kött & chark': '🥩',
  'Fisk & skaldjur': '🐟',
  Skafferi: '🥫',
  'Kryddor & såser': '🧂',
  Fryst: '🧊',
  Dryck: '🥤',
  Hushåll: '🧻',
  Övrigt: '🛒',
};

export function ListPage({ config }: { config: Config }) {
  const version = useLive('list');
  const [list, setList] = useState<ShoppingList | null>(null);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let stale = false;
    api
      .list()
      .then((fresh) => {
        if (!stale) setList(fresh);
      })
      .catch((err) => {
        if (!stale) setError(errorMessage(err));
      });
    return () => {
      stale = true;
    };
  }, [version]);

  /** Väntar in en ändring; servern svarar alltid med hela den nya listan. */
  const apply = useCallback(async (change: Promise<ShoppingList>) => {
    try {
      setList(await change);
      setError('');
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  }, []);

  const toggle = useCallback(
    (item: ListItem) => {
      const done = !item.done;
      // Visa krysset direkt; serverns svar rättar till om något gick snett.
      setList((current) =>
        current && {
          ...current,
          items: current.items.map((it) => (it.key === item.key ? { ...it, done, checked: done } : it)),
        },
      );
      // Avbockar man något som var täckt av det man har hemma ska avdraget också bort.
      const have = !done && item.covered ? item.parts.map((part) => ({ dim: part.dim, amount: 0 })) : undefined;
      void apply(api.setItemState({ key: item.key, checked: done, have }));
    },
    [apply],
  );

  const groups = useMemo(() => {
    const pending = (list?.items ?? []).filter((item) => !item.done);
    return config.categories
      .map((category) => ({ category, items: pending.filter((item) => item.category === category) }))
      .filter((group) => group.items.length > 0);
  }, [list, config.categories]);

  if (!list) {
    return error ? <ErrorBanner message={error} /> : <p className="muted">Hämtar listan…</p>;
  }

  const done = list.items.filter((item) => item.done);
  const total = list.items.length;
  const planned = new Set(list.recipes.map((recipe) => recipe.recipeId));

  const rowProps = {
    categories: config.categories,
    onToggle: toggle,
    onHave: (key: string, have: HaveChange) => void apply(api.setItemState({ key, have: [have] })),
    onCategory: (key: string, category: string) => void apply(api.setCategory(key, category)),
    onRemoveManual: (id: number) => void apply(api.removeItem(id)),
  };

  return (
    <div className="stack">
      <ErrorBanner message={error} />

      <section className="card">
        <div className="section-head">
          <h2>Veckans recept</h2>
          <button type="button" className="btn btn-sm" onClick={() => setPicking(true)}>
            + Välj recept
          </button>
        </div>
        {list.recipes.length === 0 ? (
          <p className="muted">Inga recept valda. Välj vad ni ska laga så fylls listan på av sig själv.</p>
        ) : (
          <ul className="plan">
            {list.recipes.map((recipe) => (
              <li key={recipe.recipeId}>
                <a className="plan-name" href={`#/recept/${recipe.recipeId}`}>
                  {recipe.name}
                </a>
                <Stepper
                  label={`Portioner av ${recipe.name}`}
                  value={recipe.servings}
                  suffix="port"
                  onChange={(servings) => void apply(api.planRecipe(recipe.recipeId, servings))}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Ta bort ${recipe.name} från listan`}
                  onClick={() => void apply(api.unplanRecipe(recipe.recipeId))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <QuickAdd onAdd={(text) => apply(api.addItem(text))} />

      <section>
        <div className="section-head">
          <h1>
            Att handla <span className="count">{total - done.length}</span>
          </h1>
          {total > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (window.confirm('Börja på en ny lista? Valda recept, egna varor och avprickningar tas bort.')) {
                  void apply(api.clearList());
                }
              }}
            >
              Ny lista
            </button>
          )}
        </div>

        {total > 0 && (
          <div className="progress" aria-label={`${done.length} av ${total} varor klara`}>
            <span style={{ width: `${(done.length / total) * 100}%` }} />
          </div>
        )}

        {total === 0 && <p className="muted empty">Listan är tom. Välj recept eller lägg till en vara här ovanför.</p>}
        {total > 0 && groups.length === 0 && <p className="empty">Allt är avprickat. Bra jobbat!</p>}

        {groups.map((group) => (
          <div className="cat" key={group.category}>
            <h3 className="cat-title">
              <span className="cat-emoji" aria-hidden="true">
                {CATEGORY_EMOJI[group.category]}{' '}
              </span>
              {group.category}
            </h3>
            <ul className="items">
              {group.items.map((item) => (
                <ItemRow key={item.key} item={item} {...rowProps} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      {done.length > 0 && (
        <section className="cat">
          <h3 className="cat-title">Avprickat ({done.length})</h3>
          <ul className="items">
            {done.map((item) => (
              <ItemRow key={item.key} item={item} {...rowProps} />
            ))}
          </ul>
        </section>
      )}

      {picking && (
        <RecipePicker
          planned={planned}
          onAdd={(recipe) => void apply(api.planRecipe(recipe.id, recipe.servings))}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (await onAdd(value)) setText('');
  };
  return (
    <form className="quick-add" onSubmit={submit}>
      <input
        className="input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Lägg till vara, t.ex. 2 l mjölk"
        aria-label="Lägg till vara"
        enterKeyHint="done"
      />
      <button type="submit" className="btn btn-primary">
        Lägg till
      </button>
    </form>
  );
}

interface ItemRowProps {
  item: ListItem;
  categories: string[];
  onToggle: (item: ListItem) => void;
  onHave: (key: string, have: HaveChange) => void;
  onCategory: (key: string, category: string) => void;
  onRemoveManual: (id: number) => void;
}

function ItemRow({ item, categories, onToggle, onHave, onCategory, onRemoveManual }: ItemRowProps) {
  const [open, setOpen] = useState(false);

  // Kvar att köpa – eller hela behovet när raden är avklarad.
  const amount = (item.done ? item.parts.map((part) => part.needText) : item.parts.filter((part) => part.buy > 0).map((part) => part.buyText)).join(' + ');
  const deducted = item.parts.filter((part) => part.have > 0);

  let detail = '';
  if (item.covered && !item.checked) detail = 'Har hemma';
  else if (!item.done && deducted.length > 0) {
    detail = `Behövs ${item.parts.map((part) => part.needText).join(' + ')}, har ${deducted.map((part) => part.haveText).join(' + ')} hemma`;
  }

  return (
    <li className={`item${item.done ? ' is-done' : ''}`}>
      <div className="item-row">
        <input
          type="checkbox"
          className="check"
          checked={item.done}
          onChange={() => onToggle(item)}
          aria-label={`${item.name} klar`}
        />
        <button type="button" className="item-main" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="item-name">{item.name}</span>
          {detail && <span className="item-sub">{detail}</span>}
        </button>
        <span className="item-amount">{amount}</span>
        <button
          type="button"
          className={`item-toggle${open ? ' is-open' : ''}`}
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Dölj detaljer' : 'Visa detaljer'}
        >
          ›
        </button>
      </div>

      {open && (
        <div className="item-detail">
          {item.parts.map((part) => (
            <HaveEditor
              key={part.dim}
              part={part}
              showNeed={item.parts.length > 1}
              onSave={(amountAtHome, unit) => onHave(item.key, { dim: part.dim, amount: amountAtHome, unit })}
            />
          ))}

          <ul className="sources">
            {item.sources.map((source, index) => (
              <li key={`${source.type}-${source.id}-${index}`}>
                <span>
                  {source.label}
                  {source.text && <span className="muted"> · {source.text}</span>}
                </span>
                {source.type === 'manual' && (
                  <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => onRemoveManual(source.id)}>
                    Ta bort
                  </button>
                )}
              </li>
            ))}
          </ul>

          <label className="inline-field">
            <span>Avdelning</span>
            <select
              className="select"
              value={item.category}
              onChange={(event) => onCategory(item.key, event.target.value)}
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </li>
  );
}

interface HaveEditorProps {
  part: ListPart;
  showNeed: boolean;
  onSave: (amount: number, unit: string) => void;
}

/** Anger hur mycket av en vara som redan finns hemma, så att bara resten hamnar på listan. */
function HaveEditor({ part, showNeed, onSave }: HaveEditorProps) {
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState(part.unit);
  const amount = parseAmount(value);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (typeof amount !== 'number') return;
    onSave(amount, unit);
    setValue('');
  };

  return (
    <form className="have" onSubmit={submit}>
      <span className="have-label">
        Har hemma{showNeed && <span className="muted"> (av {part.needText})</span>}
      </span>
      <input
        className="input have-amount"
        inputMode="decimal"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={part.have > 0 ? part.haveText : '0'}
        aria-label="Mängd hemma"
        aria-invalid={amount === undefined}
      />
      {part.units.length > 1 ? (
        <select className="select have-unit" value={unit} onChange={(event) => setUnit(event.target.value)} aria-label="Enhet">
          {part.units.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <span className="have-unit">{part.unit}</span>
      )}
      <button type="submit" className="btn btn-sm btn-primary" disabled={typeof amount !== 'number'}>
        Dra av
      </button>
      {part.have > 0 && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSave(0, unit)}>
          Ångra avdrag
        </button>
      )}
    </form>
  );
}

interface RecipePickerProps {
  planned: Set<number>;
  onAdd: (recipe: RecipeSummary) => void;
  onClose: () => void;
}

function RecipePicker({ planned, onAdd, onClose }: RecipePickerProps) {
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.recipes().then(setRecipes).catch((err) => setError(errorMessage(err)));
  }, []);

  const needle = query.trim().toLowerCase();
  const shown = (recipes ?? []).filter((recipe) => recipe.name.toLowerCase().includes(needle));

  return (
    <Modal title="Välj recept" onClose={onClose}>
      <ErrorBanner message={error} />
      <input
        className="input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Sök recept"
        aria-label="Sök recept"
      />
      {recipes?.length === 0 && (
        <p className="muted">
          Det finns inga recept ännu. <a href="#/recept/nytt">Lägg till det första.</a>
        </p>
      )}
      <ul className="picker">
        {shown.map((recipe) => (
          <li key={recipe.id}>
            <span className="picker-name">
              {recipe.name}
              <span className="muted"> · {formatNumber(recipe.servings)} port</span>
            </span>
            {planned.has(recipe.id) ? (
              <span className="tag">I listan ✓</span>
            ) : (
              <button type="button" className="btn btn-sm btn-primary" onClick={() => onAdd(recipe)}>
                Lägg till
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="btn" onClick={onClose}>
        Klar
      </button>
    </Modal>
  );
}
