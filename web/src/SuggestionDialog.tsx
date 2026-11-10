import { useState, type FormEvent } from 'react';
import { api } from './api';
import { errorMessage } from './format';
import { THEMES, store, stored } from './hooks';
import { ErrorBanner, Modal, toast } from './ui';

// Utkastet överlever att dialogen stängs av misstag.
let draft = '';

/** Låter vem som helst i hushållet föreslå en ändring av appen. */
export function SuggestionDialog({ page, onClose }: { page: string; onClose: () => void }) {
  const [text, setText] = useState(draft);
  const [name, setName] = useState(() => stored('mc-name') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const root = document.documentElement.dataset;
    const theme = THEMES.find((option) => option.id === root.theme)?.name ?? '';
    try {
      await api.sendSuggestion({
        text,
        name,
        page,
        theme: `${theme}, ${root.mode === 'dark' ? 'mörkt' : 'ljust'}`,
        screen: `${window.innerWidth}×${window.innerHeight}`,
      });
      store('mc-name', name.trim());
      draft = '';
      toast('Tack! Förslaget är skickat.');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Föreslå en ändring" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Vad skulle göra appen bättre?</span>
          <textarea
            className="input"
            rows={6}
            maxLength={2000}
            value={text}
            onChange={(event) => {
              draft = event.target.value;
              setText(event.target.value);
            }}
            placeholder="Beskriv vad du vill ändra, lägga till eller ta bort"
            required
            autoFocus
          />
        </label>
        <label className="field">
          <span>Ditt namn</span>
          <input className="input" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <ErrorBanner message={error} />
        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
            {busy ? 'Skickar…' : 'Skicka förslag'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Avbryt
          </button>
        </div>
      </form>
    </Modal>
  );
}
