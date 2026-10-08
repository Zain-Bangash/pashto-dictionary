import { useState } from 'react';
import useLookups from '../../hooks/useLookups';
import useFieldDefinitions from '../../hooks/useFieldDefinitions';
import StatusBadge from './StatusBadge';
import VariantResubmitForm from './VariantResubmitForm';
import SuggestionForm from './SuggestionForm';

const LINK_BTN = 'mt-2 self-start text-xs font-ui font-semibold text-terracotta hover:opacity-80 transition-opacity';
const QUIET_BTN = 'mt-1 self-start text-xs font-ui text-muted hover:text-warm transition-colors';

function Completion({ variant, onSuggest }) {
  const { fieldLabel } = useFieldDefinitions();
  const { latestSuggestion: s, missingFields = [], fillableFields = [], formsFilled = 0, formsTotal = 0 } = variant;
  const name = (f) => (f.startsWith('extra.') ? fieldLabel('variant', f.slice(6)) : f);
  const formsProgress = formsTotal > 0 && formsFilled > 0 && (
    <span className="text-[11px] font-ui text-muted/60">Forms {formsFilled}/{formsTotal}</span>
  );

  if (s && (s.status === 'pending' || s.status === 'approved')) {
    return (
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        <StatusBadge status={s.status} label={`Suggestion ${s.status}`} />
        <span className="text-[11px] font-ui text-muted/70">Waiting for review — your word stays live meanwhile.</span>
      </div>
    );
  }
  if (s?.status === 'rejected' && fillableFields.length) {
    return (
      <>
        <p className="text-xs font-ui text-red-400 mt-1">Suggestion rejected: {s.moderatorNote}</p>
        <button onClick={() => onSuggest(s)} className={LINK_BTN}>Edit &amp; resubmit suggestion</button>
      </>
    );
  }
  if (missingFields.length) {
    return (
      <>
        <p className="text-[11px] font-ui text-gold/80 mt-1">Needs: {missingFields.map(name).join(', ')}</p>
        {formsProgress}
        <button onClick={() => onSuggest(null)} className={LINK_BTN}>Complete this</button>
      </>
    );
  }
  if (fillableFields.length) {
    return (
      <div className="flex items-center gap-3">
        {formsProgress}
        <button onClick={() => onSuggest(null)} className={QUIET_BTN}>Add details</button>
      </div>
    );
  }
  return null;
}

export default function MyVariantRow({ variant, onChanged, onSuggested }) {
  const { labelFor } = useLookups();
  const [mode, setMode] = useState(null); // 'resubmit' | { suggestion }

  return (
    <li className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 overflow-hidden min-w-0 flex-1">
          <div dir="rtl" className="font-pashto text-warm text-xl">{variant.pashto}</div>
          <p className="text-sm font-ui text-muted leading-snug">{variant.definition}</p>
          {variant.region && <span className="meta-label inline-block">{labelFor('region', variant.region)}</span>}
          {variant.status === 'rejected' && variant.moderatorNote && (
            <p className="text-xs font-ui text-red-400 mt-1">Note: {variant.moderatorNote}</p>
          )}
          {variant.status === 'rejected' && !mode && (
            <button onClick={() => setMode('resubmit')} className={LINK_BTN}>Edit &amp; Resubmit</button>
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
        <StatusBadge status={variant.status} />
      </div>
    </li>
  );
}
