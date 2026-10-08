import { useState } from 'react';
import { createField } from '../../services/api';
import { textInput, LABEL_MAX, TYPE_NAMES } from './fieldStyles';

export default function NewFieldForm({ appliesTo, busy, run, onError }) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState('');

  async function submit(e) {
    e.preventDefault();
    const trimmed = label.trim();
    const options = optionsText.split('\n').map((o) => o.trim()).filter(Boolean);
    if (!trimmed) return onError('Enter a label for the new field');
    if (type === 'select' && options.length === 0) return onError('Add at least one option, one per line');

    const body = { appliesTo, type, label: trimmed, required, ...(type === 'select' && { options: options.map((o) => ({ label: o })) }) };
    if (await run(() => createField(body))) {
      setLabel('');
      setOptionsText('');
      setRequired(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label={`Add ${appliesTo} field`} className="border-t border-white/[0.06] pt-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          aria-label={`New ${appliesTo} field label`}
          placeholder="New field label…"
          value={label}
          maxLength={LABEL_MAX}
          onChange={(e) => setLabel(e.target.value)}
          className={`${textInput} flex-1 min-w-0`}
        />
        <select
          aria-label={`New ${appliesTo} field type`}
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={`${textInput} sm:w-40`}
        >
          {Object.entries(TYPE_NAMES).map(([value, name]) => (
            <option key={value} value={value} className="bg-charcoal">{name}</option>
          ))}
        </select>
      </div>
      {type === 'select' && (
        <textarea
          aria-label={`New ${appliesTo} field options`}
          placeholder="Options, one per line"
          rows={3}
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          className={textInput}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-ui text-muted">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required on new submissions
        </label>
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-terracotta text-warm text-xs font-ui font-semibold rounded-[10px] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Add field
        </button>
      </div>
    </form>
  );
}
