import { useEffect, useState, type ReactNode } from 'react';
import { api, type Config } from './api';
import { errorMessage } from './format';
import { THEMES, useAppearance, useRoute } from './hooks';
import { AppearancePage } from './pages/AppearancePage';
import { ListPage } from './pages/ListPage';
import { RecipeEditor } from './pages/RecipeEditor';
import { RecipePage } from './pages/RecipePage';
import { RecipesPage } from './pages/RecipesPage';
import { SuggestionDialog } from './SuggestionDialog';
import { ErrorBanner, Toaster } from './ui';

type Section = 'list' | 'recipes' | 'look';

const NAV: { section: Section; href: string; label: string; icon: ReactNode }[] = [
  {
    section: 'list',
    href: '#/',
    label: 'Inköpslista',
    icon: <path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />,
  },
  {
    section: 'recipes',
    href: '#/recept',
    label: 'Recept',
    icon: <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zm0 13a3 3 0 0 1 3-3h11M9 8h6" />,
  },
  {
    section: 'look',
    href: '#/utseende',
    label: 'Utseende',
    icon: <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.6-1-2 0-3 .6-.6 1.6-.5 3-.5a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5zM7.5 11h.01M10 7h.01M15 7.5h.01" />,
  },
];

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function App() {
  const path = useRoute();
  const appearance = useAppearance();
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState('');
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    api.config().then(setConfig).catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  const tagline = THEMES.find((theme) => theme.id === appearance.theme)?.tagline;
  const { section, page } = route(path, config, appearance);

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="brand-name">Matcentralen</span>
          <span className="tagline">{tagline}</span>
        </a>
        <nav className="nav" aria-label="Huvudmeny">
          {NAV.map((item) => (
            <a
              key={item.section}
              className="nav-item"
              href={item.href}
              aria-current={item.section === section ? 'page' : undefined}
            >
              <NavIcon>{item.icon}</NavIcon>
              {item.label}
            </a>
          ))}
          {config?.suggestionsEnabled && (
            <button type="button" className="nav-item" onClick={() => setSuggesting(true)}>
              <NavIcon>
                <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
              </NavIcon>
              Förslag
            </button>
          )}
        </nav>
      </header>
      <main>
        <ErrorBanner message={error} />
        {page}
      </main>
      {suggesting && <SuggestionDialog page={path} onClose={() => setSuggesting(false)} />}
      <Toaster />
    </div>
  );
}

function route(
  path: string,
  config: Config | null,
  appearance: ReturnType<typeof useAppearance>,
): { section: Section; page: ReactNode } {
  if (path === '/utseende') return { section: 'look', page: <AppearancePage {...appearance} /> };
  // Övriga sidor behöver enhets- och avdelningslistorna från servern.
  if (!config) return { section: path.startsWith('/recept') ? 'recipes' : 'list', page: null };

  if (path === '/recept') return { section: 'recipes', page: <RecipesPage /> };
  if (path === '/recept/nytt') return { section: 'recipes', page: <RecipeEditor key="new" id={null} config={config} /> };
  const recipe = path.match(/^\/recept\/(\d+)(\/redigera)?$/);
  if (recipe) {
    const id = Number(recipe[1]);
    return {
      section: 'recipes',
      page: recipe[2] ? <RecipeEditor key={id} id={id} config={config} /> : <RecipePage key={id} id={id} />,
    };
  }
  return { section: 'list', page: <ListPage config={config} /> };
}
