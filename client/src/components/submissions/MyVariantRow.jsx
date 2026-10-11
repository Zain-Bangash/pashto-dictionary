import { useState } from 'react';
import useLookups from '../../hooks/useLookups';
import useFieldDefinitions from '../../hooks/useFieldDefinitions';
import StatusBadge from './StatusBadge';
import VariantResubmitForm from './VariantResubmitForm';
import SuggestionForm from './SuggestionForm';
import EditDiff from '../moderation/EditDiff';

const EDIT_BTN = 'inline-flex items-center gap-1.5 font-ui font-semibold text-xs text-warm/80 border border-white/[0.14] rounded-xl px-3.5 py-1.5 hover:border-terracotta/60 hover:bg-terracotta/10 hover:text-warm transition-all';
const CHIP = 'inline-flex items-center gap-1 font-ui text-[11px] font-semibold text-gold border border-gold/35 bg-gold/[0.08] rounded-full px-2.5 py-1 hover:bg-gold/[0.16] hover:border-gold/55 transition-colors';

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function Completion({ variant, onSuggest }) {
  const { fieldLabel } = useFieldDefinitions();
  const { latestSuggestion: s, missingFields = [] } = variant;
  const label = (f) => (f.startsWith('extra.') ? fieldLabel('variant', f.slice(6)) : capitalise(f));
  const diff = s && <EditDiff variant={variant} proposed={s.proposed} baseline={s.baseline} heading="Your suggested changes" />;

  if (s && (s.status === 'pending' || s.status === 'approved')) {
    return (
      <>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <StatusBadge status={s.status} label={`Suggestion ${s.status}`} />
          <span className="text-[11px] font-ui text-muted/70">Waiting for review — your word stays live meanwhile.</span>
        </div>
        {diff}
      </>
    );
  }
  if (s?.status === 'rejected') {
    return (
      <>
        <p className="text-xs font-ui text-red-400 mt-2">Suggestion rejected: {s.moderatorNote}</p>
        {diff}
      </>
    );
  }
  if (!missingFields.length) return null;
  return (
    <div role="group" aria-label="Missing details" className="mt-2 flex items-center gap-2 flex-wrap">
      <span className="font-ui text-[9px] font-semibold uppercase tracking-[0.16em] text-gold/80">Needs</span>
      {missingFields.map((f) => (
        <button key={f} type="button" onClick={() => onSuggest(null)} aria-label={`Add ${label(f)}`} className={CHIP}>
          <span aria-hidden="true">+</span>
          {label(f)}
        </button>
      ))}
    </div>
  );
}

// The one visible way to change a word: edit a rejected entry, edit or complete a published one, or resubmit a rejected suggestion
function editAction(variant, setMode) {
  const s = variant.latestSuggestion;
  if (variant.status === 'rejected') return { label: 'Edit & Resubmit', run: () => setMode('resubmit') };
  if (variant.status !== 'published' || s?.status === 'pending' || s?.status === 'approved') return null;
  if (s?.status === 'rejected') return { label: 'Edit & resubmit suggestion', run: () => setMode({ suggestion: s }) };
  return { label: 'Edit', run: () => setMode({ suggestion: null }) };
}

export default function MyVariantRow({ variant, onChanged, onSuggested }) {
  const { labelFor } = useLookups();
  const [mode, setMode] = useState(null); // 'resubmit' | { suggestion }
  const action = !mode && editAction(variant, setMode);
  const { formsFilled = 0, formsTotal = 0, missingFields = [] } = variant;

  return (
    <li className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 overflow-hidden min-w-0 flex-1">
          <div dir="rtl" className="font-pashto text-warm text-2xl">{variant.pashto}</div>
          <p className="font-display italic text-warm/80 text-base leading-snug">{variant.definition}</p>
          <div className="flex items-center gap-3 flex-wrap">
            {variant.region && <span className="meta-label inline-block">{labelFor('region', variant.region)}</span>}
            {variant.status === 'published' && formsFilled > 0 && formsTotal > 0 && !missingFields.includes('forms') && (
              <span className="text-[11px] font-ui text-muted/60">Forms {formsFilled}/{formsTotal}</span>
            )}
          </div>
          {variant.status === 'rejected' && variant.moderatorNote && (
            <p className="text-xs font-ui text-red-400 mt-1">Note: {variant.moderatorNote}</p>
          )}
          {variant.status === 'published' && !mode && (
            <Completion variant={variant} onSuggest={(suggestion) => setMode({ suggestion })} />
          )}
          {mode === 'resubmit' && (
            <VariantResubmitForm
              variant={variant}
              onSave={(updated) => { setMode(null); onChanged(updated); }}
              onCancel={() => setMode(null)}
            />
          )}
          {mode?.suggestion !== undefined && (
            <SuggestionForm
              variant={variant}
              suggestion={mode.suggestion}
              onDone={() => { setMode(null); onSuggested(); }}
              onCancel={() => setMode(null)}
            />
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={variant.status} />
          {action && (
            <button type="button" onClick={action.run} className={EDIT_BTN}>
              <PencilIcon />
              {action.label}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
