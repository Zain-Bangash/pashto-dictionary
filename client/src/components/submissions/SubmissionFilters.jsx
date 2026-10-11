import { useState, useEffect } from 'react';
import useDebouncedValue from '../../hooks/useDebouncedValue';

import { CHIP, REVIEW_OPTIONS } from './filterOptions';

const CHIP_ON = 'bg-mint/15 border-mint/40 text-mint';
const CHIP_OFF = 'bg-white/[0.04] border-white/[0.08] text-muted hover:text-warm';

// Status chips with the number of submissions in each. A status with none is hidden unless it is the one selected.
export function StatusChips({ options = REVIEW_OPTIONS, counts, value, onChange, disabled = false, keepEmpty = false }) {
  return (
    <div role="group" aria-label="Filter by status" className="flex items-center gap-2 flex-wrap">
      {options.map(([status, label]) => {
        const count = status === '' ? counts?.total : counts?.[status];
        if (!keepEmpty && counts && count === 0 && status !== '' && status !== value) return null;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={value === status}
            disabled={disabled}
            onClick={() => onChange(status)}
            className={`${CHIP} ${value === status ? CHIP_ON : CHIP_OFF} disabled:opacity-40`}
          >
            {label}{count !== undefined && ` (${count})`}
          </button>
        );
      })}
    </div>
  );
}

// Reports what was typed once the person pauses; clearing it is just deleting the text.
// A value changed from outside (a "Clear filters" button, a clicked username) replaces the text.
export function SearchBox({ label, value, onChange, className = '' }) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== text.trim()) setText(value);
  }
  const debounced = useDebouncedValue(text.trim());
  useEffect(() => {
    if (debounced === text.trim() && debounced !== value) onChange(debounced);
  }, [debounced, text, value, onChange]);

  return (
    <input
      type="search"
      aria-label={label}
      placeholder={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      maxLength={100}
      className={`bg-white/[0.06] border border-white/[0.12] rounded-[10px] px-3 py-1.5 text-xs font-ui text-warm placeholder-white/30 focus:outline-none focus:border-terracotta/60 min-w-[12rem] flex-1 ${className}`}
    />
  );
}

export function EmptyList({ children }) {
  return <p className="text-muted font-ui text-sm py-4">{children}</p>;
}
