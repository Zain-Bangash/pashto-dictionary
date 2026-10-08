import { useState } from 'react';
import { smallBtn, LABEL_MAX } from './fieldStyles';

export default function InlineRename({ value, ariaLabel, busy, onSave, onCancel }) {
  const [label, setLabel] = useState(value);
  const trimmed = label.trim();

  async function submit(e) {
    e.preventDefault();
    if (!trimmed || trimmed === value) return onCancel();
    if (await onSave(trimmed)) onCancel();
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 flex-1 min-w-0">
      <input
        aria-label={ariaLabel}
        value={label}
        maxLength={LABEL_MAX}
        onChange={(e) => setLabel(e.target.value)}
        className="flex-1 min-w-0 bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-gold/50"
        autoFocus
      />
      <button type="submit" disabled={busy || !trimmed} className={smallBtn}>Save</button>
      <button type="button" onClick={onCancel} className={smallBtn}>Cancel</button>
    </form>
  );
}
