import { useEffect, useState } from 'react';
import { api, type Recipe } from '../api';
import { errorMessage, formatNumber, portions } from '../format';
import { navigate, useLive } from '../hooks';
import { ErrorBanner, Stepper, toast } from '../ui';

export function RecipePage({ id }: { id: number }) {
  const version = useLive('recipes');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState('');
  // Antal portioner som visas just nu; null betyder receptets eget antal.
  const [shown, setShown] = useState<number | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    let stale = false;
    api
      .recipe(id)
      .then((fresh) => {
        if (!stale) setRecipe(fresh);
      })
      .catch((err) => {
        if (!stale) setError(errorMessage(err));
      });
    return () => {
      stale = true;
    };
  }, [id, version]);

  if (!recipe) {
    return error ? <ErrorBanner message={error} /> : <p className="muted">Hämtar receptet…</p>;
  }

  const servings = shown ?? recipe.plannedServings ?? recipe.servings;
  const factor = servings / recipe.servings;

  const run = async (action: Promise<unknown>, done?: string) => {
    try {
      await action;
      setError('');
      if (done) toast(done);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  };

  const remove = async () => {
    if (!window.confirm(`Ta bort receptet "${recipe.name}"?`)) return;
    if (await run(api.deleteRecipe(recipe.id))) navigate('/recept');
  };

  return (
    <div className="stack">
      <a className="back" href="#/recept">
        ‹ Alla recept
      </a>
      <ErrorBanner message={error} />

      <div>
        <h1>{recipe.name}</h1>
        {recipe.sourceUrl && (
          <a className="source" href={recipe.sourceUrl} target="_blank" rel="noreferrer">
            {hostname(recipe.sourceUrl)} ↗
          </a>
        )}
      </div>

      <section className="card stack">
        <div className="servings-row">
          <Stepper label="Portioner att visa" value={servings} suffix="port" onChange={setShown} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              run(
                api.planRecipe(recipe.id, servings),
                `${recipe.name} ligger i listan (${portions(servings)})`,
              )
            }
          >
            {recipe.plannedServings == null ? 'Lägg i inköpslistan' : 'Uppdatera i listan'}
          </button>
        </div>
        {recipe.plannedServings != null && (
          <p className="muted small">Ligger i inköpslistan med {portions(recipe.plannedServings)}.</p>
        )}

        {adjusting ? (
          <ServingsAdjuster
            current={recipe.servings}
            onCancel={() => setAdjusting(false)}
            onSave={async (actual) => {
              if (await run(api.setRecipeServings(recipe.id, actual), 'Portionsantalet är justerat')) {
                setAdjusting(false);
              }
            }}
          />
        ) : (
          <p className="muted small">
            Receptet räknas som {portions(recipe.servings)}.{' '}
            <button type="button" className="link" onClick={() => setAdjusting(true)}>
              Stämmer det inte?
            </button>
          </p>
        )}
      </section>

      <section className="card">
        <h2>Ingredienser</h2>
        <ul className="ingredients">
          {recipe.ingredients.map((ing, index) => (
            <li key={index}>
              <span className="ing-amount">
                {ing.amount != null && `${formatNumber(ing.amount * factor)} ${ing.unit ?? 'st'}`}
              </span>
              <span>
                {ing.name}
                {ing.note && <span className="muted">, {ing.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {recipe.instructions && (
        <section className="card">
          <h2>Gör så här</h2>
          <div className="steps">
            {recipe.instructions.split('\n').filter((line) => line.trim()).map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </section>
      )}

      {recipe.notes && (
        <section className="card">
          <h2>Anteckningar</h2>
          <p className="notes">{recipe.notes}</p>
        </section>
      )}

      <div className="actions">
        <a className="btn" href={`#/recept/${recipe.id}/redigera`}>
          Redigera
        </a>
        <button type="button" className="btn btn-danger" onClick={remove}>
          Ta bort
        </button>
      </div>
    </div>
  );
}

interface ServingsAdjusterProps {
  current: number;
  onSave: (servings: number) => void;
  onCancel: () => void;
}

/**
 * Rättar hur många portioner receptet faktiskt räcker till. Mängderna i
 * receptet ändras inte – bara hur mycket som går åt per portion.
 */
function ServingsAdjuster({ current, onSave, onCancel }: ServingsAdjusterProps) {
  const [actual, setActual] = useState(current);
  return (
    <div className="adjust">
      <strong>Hur många portioner räcker receptet till på riktigt?</strong>
      <p className="muted small">
        Mängderna i receptet står kvar. Det som ändras är hur mycket inköpslistan räknar med per portion.
      </p>
      <div className="servings-row">
        <Stepper label="Faktiskt antal portioner" value={actual} suffix="port" onChange={setActual} />
        <button type="button" className="btn btn-primary" onClick={() => onSave(actual)} disabled={actual === current}>
          Spara
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Avbryt
        </button>
      </div>
    </div>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
