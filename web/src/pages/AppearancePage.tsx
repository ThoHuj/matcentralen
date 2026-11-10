import { THEMES, type Mode } from '../hooks';

const MODES: { id: Mode; label: string }[] = [
  { id: 'auto', label: 'Följ enheten' },
  { id: 'light', label: 'Ljust' },
  { id: 'dark', label: 'Mörkt' },
];

interface AppearancePageProps {
  theme: string;
  setTheme: (theme: string) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
}

export function AppearancePage({ theme, setTheme, mode, setMode }: AppearancePageProps) {
  return (
    <div className="stack">
      <h1>Utseende</h1>
      <p className="muted">Valet sparas på den här enheten, så ni kan ha var sin stil.</p>

      <section className="card stack">
        <h2>Ljust eller mörkt</h2>
        <div className="seg" role="group" aria-label="Ljust eller mörkt läge">
          {MODES.map((option) => (
            <button key={option.id} type="button" aria-pressed={mode === option.id} onClick={() => setMode(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2>Tema</h2>
        <div className="theme-grid">
          {THEMES.map((option) => (
            // Varje kort bär sitt eget tema, så förhandsvisningen ritas med temats riktiga färger och typsnitt.
            <button
              key={option.id}
              type="button"
              data-theme={option.id}
              className={`theme-card${theme === option.id ? ' is-active' : ''}`}
              aria-pressed={theme === option.id}
              onClick={() => setTheme(option.id)}
            >
              <span className="theme-name">{option.name}</span>
              <span className="theme-sample">
                <span className="theme-check" aria-hidden="true" />
                <span>Mjölk</span>
                <strong>2 l</strong>
              </span>
              <span className="theme-chip">Lägg till</span>
              <span className="theme-blurb">{option.blurb}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
