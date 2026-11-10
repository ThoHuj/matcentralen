import { useEffect, useState, useSyncExternalStore } from 'react';

// --- Navigering via adressfältets #-del ---------------------------------------

function currentPath(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

function subscribeToHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): string {
  return useSyncExternalStore(subscribeToHash, currentPath);
}

export function navigate(path: string) {
  window.location.hash = path;
}

// --- Liveuppdateringar från servern -------------------------------------------

type Listener = (topic: string) => void;
const listeners = new Set<Listener>();
let started = false;

function startLiveUpdates() {
  if (started) return;
  started = true;
  const notifyAll = () => listeners.forEach((listener) => listener('*'));
  let source: EventSource | null = null;

  const connect = () => {
    source = new EventSource('/api/events');
    source.onmessage = (event) => listeners.forEach((listener) => listener(String(event.data)));
    // Efter ett avbrott kan vi ha missat ändringar, så allt hämtas om.
    source.onopen = notifyAll;
  };

  // En dold flik behöver ingen öppen anslutning. Det sparar batteri på mobilen
  // och håller nere antalet samtidiga anslutningar när många flikar är öppna.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!source) connect();
    } else {
      source?.close();
      source = null;
    }
  });
  connect();
}

/** Ett tal som ökar varje gång något av de angivna ämnena ändras på servern. */
export function useLive(...topics: string[]): number {
  const [version, setVersion] = useState(0);
  const key = topics.join(',');
  useEffect(() => {
    startLiveUpdates();
    const wanted = key.split(',');
    const listener: Listener = (topic) => {
      if (topic === '*' || wanted.includes(topic)) setVersion((v) => v + 1);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [key]);
  return version;
}

// --- Utseende -----------------------------------------------------------------

export type Mode = 'auto' | 'light' | 'dark';

export interface Theme {
  id: string;
  name: string;
  tagline: string;
  blurb: string;
}

export const THEMES: Theme[] = [
  { id: 'minimal', name: 'Minimalistisk', tagline: 'Mat. Lista. Klart.', blurb: 'Luftigt, lugnt och utan krusiduller.' },
  { id: 'avant', name: 'Avantgarde', tagline: 'Inköp är en konstform', blurb: 'Hårda kanter, stora bokstäver, rött.' },
  { id: 'hack', name: 'Hackig', tagline: '$ sudo handla --allt', blurb: 'Terminalgrönt för den som lagar mat i vim.' },
  { id: 'renaissance', name: 'Renässans', tagline: 'Hushållets förnämsta inköpslängd', blurb: 'Pergament, bladguld och värdighet.' },
  { id: 'art', name: 'Konstnärlig', tagline: 'Komponera veckans smaker', blurb: 'Akvarell, penseldrag och mjuka former.' },
  { id: 'fun', name: 'Rolig', tagline: 'Vem åt upp all ost?!', blurb: 'Prickigt, studsigt och lite för glatt.' },
];

export function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Utan lagring gäller valet bara tills sidan laddas om.
  }
}

export function useAppearance() {
  const [theme, setTheme] = useState(() => {
    const saved = stored('mc-theme');
    return THEMES.some((t) => t.id === saved) ? (saved as string) : THEMES[0].id;
  });
  const [mode, setMode] = useState<Mode>(() => {
    const saved = stored('mc-mode');
    return saved === 'light' || saved === 'dark' ? saved : 'auto';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store('mc-theme', theme);
  }, [theme]);

  useEffect(() => {
    store('mc-mode', mode);
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'auto' && system.matches);
      document.documentElement.dataset.mode = dark ? 'dark' : 'light';
    };
    apply();
    system.addEventListener('change', apply);
    return () => system.removeEventListener('change', apply);
  }, [mode]);

  return { theme, setTheme, mode, setMode };
}
