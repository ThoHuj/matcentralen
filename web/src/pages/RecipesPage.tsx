import { useEffect, useState } from 'react';
import { api, type RecipeSummary } from '../api';
import { errorMessage, portions } from '../format';
import { useLive } from '../hooks';
import { ErrorBanner, Stepper, toast } from '../ui';

export function RecipesPage() {
  const version = useLive('recipes');
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let stale = false;
    api
      .recipes()
      .then((fresh) => {
        if (!stale) setRecipes(fresh);
      })
      .catch((err) => {
        if (!stale) setError(errorMessage(err));
      });
    return () => {
      stale = true;
    };
  }, [version]);

  // Listan över recept laddas om via liveuppdateringen när planen ändras.
  const change = async (action: Promise<unknown>, done?: string) => {
    try {
      await action;
      setError('');
      if (done) toast(done);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const needle = query.trim().toLowerCase();
  const shown = (recipes ?? []).filter((recipe) => recipe.name.toLowerCase().includes(needle));

  return (
    <div className="stack">
      <div className="section-head">
        <h1>Recept</h1>
        <a className="btn btn-primary" href="#/recept/nytt">
          + Nytt recept
        </a>
      </div>
      <ErrorBanner message={error} />

      {recipes === null && !error && <p className="muted">Hämtar recept…</p>}

      {recipes?.length === 0 && (
        <div className="card empty">
          <p>Här var det tomt.</p>
          <p className="muted">Lägg till ert första recept – klistra in en länk så läser AI:n av ingredienserna åt er.</p>
        </div>
      )}

      {recipes && recipes.length > 0 && (
        <input
          className="input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sök recept"
          aria-label="Sök recept"
        />
      )}

      {recipes && recipes.length > 0 && shown.length === 0 && <p className="muted">Inget recept matchar sökningen.</p>}

      <ul className="recipe-list">
        {shown.map((recipe) => (
          <li className="card recipe-card" key={recipe.id}>
            <a className="recipe-link" href={`#/recept/${recipe.id}`}>
              <span className="recipe-name">{recipe.name}</span>
              <span className="muted">
                {portions(recipe.servings)} · {recipe.ingredientCount} ingredienser
              </span>
            </a>
            {recipe.plannedServings == null ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => change(api.planRecipe(recipe.id, recipe.servings), `${recipe.name} ligger i listan`)}
              >
                + I listan
              </button>
            ) : (
              <div className="recipe-planned">
                <Stepper
                  label={`Portioner av ${recipe.name}`}
                  value={recipe.plannedServings}
                  suffix="port"
                  onChange={(servings) => change(api.planRecipe(recipe.id, servings))}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Ta bort ${recipe.name} från listan`}
                  onClick={() => change(api.unplanRecipe(recipe.id))}
                >
                  ✕
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
