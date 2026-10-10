import useFieldDefinitions from '../../hooks/useFieldDefinitions';
import { slotLabel } from '../../utils/forms';
import { audioSlotLabel } from '../../utils/audio';

const OWNER = { Concept: 'concept', Variant: 'variant', VariantSuggestion: 'variant' };

// Form diffs store { pashto, phonetic?, example? } or null for an added/removed form
function show(value) {
  if (value === null) return '—';
  if (value && typeof value === 'object' && 'pashto' in value) {
    return [value.pashto, value.phonetic && `/${value.phonetic}/`, value.example].filter(Boolean).join(' · ');
  }
  return String(value);
}

function Diff({ field, diff }) {
  return (
    <p className="text-[11px] font-ui text-muted/70">
      <span className="text-muted/40">{field}: </span>
      <span dir="auto" className="line-through text-muted/50">{show(diff.from)}</span>
      <span className="text-muted/40 mx-1">→</span>
      <span dir="auto" className="text-warm/70">{show(diff.to)}</span>
    </p>
  );
}

function LookupChange({ changes }) {
  const { op } = changes;
  const line = 'text-[11px] font-ui text-muted/70 mt-1.5';
  if (op === 'created') return <p className={line}>Added “{changes.label}”</p>;
  if (op === 'deactivated') return <p className={line}>Deactivated</p>;
  if (op === 'reactivated') return <p className={line}>Reactivated</p>;
  if (op === 'reordered' && Array.isArray(changes.to)) {
    return <p className={line}>New order: {changes.to.join(', ')}</p>;
  }
  if (op === 'updated') {
    return (
      <div className="mt-1.5 space-y-0.5">
        {changes.label && <Diff field="label" diff={changes.label} />}
        {changes.order && <Diff field="order" diff={changes.order} />}
      </div>
    );
  }
  return null;
}

function FieldChange({ changes }) {
  const { op, option } = changes;
  const line = 'text-[11px] font-ui text-muted/70 mt-1.5';
  const optionName = option?.label?.to ?? option?.label;
  if (op === 'created') return <p className={line}>Added {changes.type} field “{changes.label}”{changes.required ? ' (required)' : ''}</p>;
  if (op === 'deactivated' || op === 'reactivated') return <p className={line}>{op === 'deactivated' ? 'Deactivated' : 'Reactivated'}</p>;
  if (op === 'reordered' && Array.isArray(changes.to)) return <p className={line}>New order: {changes.to.join(', ')}</p>;
  if (op === 'option_added') return <p className={line}>Added option “{optionName}”</p>;
  if (op === 'option_deactivated') return <p className={line}>Deactivated option “{optionName}”</p>;
  if (op === 'option_reactivated') return <p className={line}>Reactivated option “{optionName}”</p>;
  if (op === 'option_renamed') return <div className="mt-1.5"><Diff field="option" diff={option.label} /></div>;
  if (op === 'updated') {
    return (
      <div className="mt-1.5 space-y-0.5">
        {['label', 'required', 'order'].filter((f) => changes[f]).map((f) => <Diff key={f} field={f} diff={changes[f]} />)}
      </div>
    );
  }
  return null;
}

export default function LogChanges({ log }) {
  const { action, changes, note } = log;
  const { fieldLabel } = useFieldDefinitions();
  const displayName = (field) => {
    if (field.startsWith('extra.')) return fieldLabel(OWNER[log.targetModel], field.slice(6));
    if (field.startsWith('forms.')) return `form (${slotLabel(field.slice(6))})`;
    return field;
  };

  if (action === 'field_changed' && changes && typeof changes === 'object') {
    return <FieldChange changes={changes} />;
  }

  if (action === 'lookup_changed' && changes && typeof changes === 'object') {
    return <LookupChange changes={changes} />;
  }

  if (['edited', 'suggestion_applied', 'role_changed'].includes(action) && changes && typeof changes === 'object') {
    const fields = Object.entries(changes).filter(([, v]) => v && typeof v === 'object' && 'from' in v);
    if (fields.length === 0) return null;
    return (
      <div className="mt-1.5 space-y-0.5">
        {fields.map(([field, diff]) => <Diff key={field} field={displayName(field)} diff={diff} />)}
        {note && <p className="text-[11px] font-ui text-muted/50 italic">{note}</p>}
      </div>
    );
  }

  if (action === 'merged' && changes && typeof changes === 'object') {
    const moved   = Array.isArray(changes.variantsMoved)   ? changes.variantsMoved.length   : 0;
    const skipped = Array.isArray(changes.variantsSkipped) ? changes.variantsSkipped.length : 0;
    return (
      <p className="text-[11px] font-ui text-muted/70 mt-1.5">
        {moved} variant{moved !== 1 ? 's' : ''} moved
        {skipped > 0 && <>, {skipped} skipped (duplicate)</>}
        {note && <> · <span className="italic">{note}</span></>}
      </p>
    );
  }

  if (action === 'audio_published' && changes?.slot) {
    return (
      <p className="text-[11px] font-ui text-muted/70 mt-1.5">
        {audioSlotLabel(changes.slot)} recording {changes.replaced ? 'replaced' : 'added'}
      </p>
    );
  }

  if (note) {
    return <p className="text-[11px] font-ui text-muted/60 italic mt-1">{note}</p>;
  }

  return null;
}
