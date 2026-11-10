import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatNumber } from './format';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  suffix?: string;
}

/** Plus/minus-väljare för portioner. */
export function Stepper({ value, onChange, label, suffix }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Minska">
        −
      </button>
      <span className="stepper-value">
        {formatNumber(value)}
        {suffix && <small> {suffix}</small>}
      </span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Öka">
        +
      </button>
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onClose}
      onClick={(event) => {
        // Klick på själva dialogen (inte innehållet) betyder klick på bakgrunden.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal-body">
        <div className="section-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Stäng">
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

// --- Kort bekräftelse längst ned på skärmen -----------------------------------

let showToast: (message: string) => void = () => {};

export function toast(message: string) {
  showToast(message);
}

export function Toaster() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    let timer: number | undefined;
    showToast = (text) => {
      setMessage(text);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(''), 2500);
    };
    return () => {
      showToast = () => {};
      window.clearTimeout(timer);
    };
  }, []);
  return (
    <div className="toast-area" role="status" aria-live="polite">
      {message && <div className="toast">{message}</div>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="banner banner-error" role="alert">
      {message}
    </div>
  );
}
