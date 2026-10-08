import { useState } from 'react';
import { updateField, deactivateField, reactivateField } from '../../services/api';
import InlineRename from './InlineRename';
import FieldOptionsEditor from './FieldOptionsEditor';
import { smallBtn, badge, TYPE_NAMES } from './fieldStyles';

export default function FieldRow({ def, isFirst, isLast, busy, run, onMove }) {
  const [renaming, setRenaming] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  return (
    <li className={`bg-white/[0.035] border border-white/[0.08] rounded-[16px] px-4 py-3 ${def.active ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <button type="button" aria-label={`Move ${def.label} up`} disabled={busy || isFirst} onClick={() => onMove(-1)} className={smallBtn}>↑</button>
          <button type="button" aria-label={`Move ${def.label} down`} disabled={busy || isLast} onClick={() => onMove(1)} className={smallBtn}>↓</button>
        </div>

        {renaming ? (
          <InlineRename
            value={def.label}
            ariaLabel={`Label for ${def.key}`}
            busy={busy}
            onSave={(label) => run(() => updateField(def._id, { label }))}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-ui text-warm truncate">{def.label}</span>
              <span className={`${badge} border-white/[0.12] text-muted`}>{TYPE_NAMES[def.type]}</span>
              {def.required && <span className={`${badge} border-gold/30 text-gold`}>Required</span>}
              {!def.active && <span className={`${badge} border-white/[0.15] text-muted`}>Inactive</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {def.type === 'select' && (
                <button type="button" aria-expanded={showOptions} onClick={() => setShowOptions((v) => !v)} className={smallBtn}>
                  Options ({def.options.length})
                </button>
              )}
              <button type="button" onClick={() => setRenaming(true)} disabled={busy} className={smallBtn}>Rename</button>
              <button type="button" disabled={busy} onClick={() => run(() => updateField(def._id, { required: !def.required }))} className={smallBtn}>
                {def.required ? 'Make optional' : 'Make required'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => (def.active ? deactivateField(def._id) : reactivateField(def._id)))}
                className={smallBtn}
              >
                {def.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </>
        )}
      </div>
      {showOptions && def.type === 'select' && <FieldOptionsEditor def={def} busy={busy} run={run} />}
    </li>
  );
}
