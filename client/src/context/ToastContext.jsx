import { useState, useCallback, useRef } from 'react';
import { ToastContext } from './toastValue';

const LIFETIME_MS = 4000;
const TONES = {
  success: 'border-mint/30 text-warm',
  error: 'border-red-400/40 text-red-300',
};

// Success toasts fade on their own; error toasts stay until dismissed
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback((message, { tone = 'success' } = {}) => {
    const id = ++nextId.current;
    setToasts((t) => [...t.slice(-3), { id, message, tone }]);
    if (tone !== 'error') setTimeout(() => dismiss(id), LIFETIME_MS);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 z-50 flex flex-col gap-2 items-stretch sm:items-end pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 bg-charcoal/95 backdrop-blur-[24px] border rounded-[14px] px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.45)] font-ui text-sm max-w-sm ${TONES[t.tone] ?? TONES.success}`}
          >
            <span className="flex-1 break-words">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted hover:text-warm transition-colors">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
