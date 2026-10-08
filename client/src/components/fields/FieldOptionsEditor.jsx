import { useState } from 'react';
import { addFieldOption, renameFieldOption, deactivateFieldOption, reactivateFieldOption } from '../../services/api';
import InlineRename from './InlineRename';
import { smallBtn, textInput, badge, LABEL_MAX } from './fieldStyles';

export default function FieldOptionsEditor({ def, busy, run }) {
  const [renaming, setRenaming] = useState(null);
  const [label, setLabel] = useState('');

  async function add(e) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    if (await run(() => addFieldOption(def._id, trimmed))) setLabel('');
  }

  return (
    <div className="mt-3 ml-10 space-y-2">
      <ul className="space-y-1.5">
        {def.options.map((o) => (
          <li key={o._id} className={`flex items-center gap-2 ${o.active ? '' : 'opacity-60'}`}>
            {renaming === o._id ? (
              <InlineRename
                value={o.label}
                ariaLabel={`Option label for ${o.key}`}
                busy={busy}
                onSave={(newLabel) => run(() => renameFieldOption(def._id, o._id, newLabel))}
                onCancel={() => setRenaming(null)}
              />
            ) : (
              <>
                <span className="flex-1 min-w-0 text-sm font-ui text-warm/90 truncate">{o.label}</span>
                {!o.active && <span className={`${badge} border-white/[0.15] text-muted`}>Inactive</span>}
                <button type="button" onClick={() => setRenaming(o._id)} disabled={busy} className={smallBtn}>Rename</button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => (o.active ? deactivateFieldOption(def._id, o._id) : reactivateFieldOption(def._id, o._id)))}
                  className={smallBtn}
                >
                  {o.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex items-center gap-2">
        <input
          aria-label={`New option for ${def.label}`}
          placeholder="Add an option…"
          value={label}
          maxLength={LABEL_MAX}
          onChange={(e) => setLabel(e.target.value)}
          className={`${textInput} flex-1 min-w-0`}
        />
        <button type="submit" disabled={busy || !label.trim()} className={smallBtn}>Add option</button>
      </form>
    </div>
  );
}
