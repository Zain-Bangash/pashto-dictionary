import { useId, useState } from 'react';
import useLookups from '../../hooks/useLookups';
import { formSlot, slotLabel, sortForms } from '../../utils/forms';
import { speakerCredit } from '../../utils/audio';

// ownerSub: the word's submitter; forms they added carry no separate credit
export default function FormsDisplay({ forms, ownerSub, className = '' }) {
  const { labelFor } = useLookups();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!forms?.length) return null;

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-ui font-semibold text-muted hover:text-warm transition-colors"
      >
        {open ? '▾' : '▸'} Forms ({forms.length})
      </button>
      {open && (
        <ul id={panelId} className="mt-2 divide-y divide-white/[0.06] border border-white/[0.06] rounded-[12px]">
          {sortForms(forms).map((form) => (
            <li key={formSlot(form)} className="px-3 py-2">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span dir="ltr" className="text-[11px] font-ui text-muted uppercase tracking-wider">{slotLabel(formSlot(form))}</span>
                <div className="flex items-baseline gap-2">
                  {form.phonetic && <span className="font-display text-sm italic text-gold">{form.phonetic}</span>}
                  <span dir="rtl" className="font-pashto text-warm text-lg">{form.pashto}</span>
                </div>
              </div>
              {form.example && <p dir="auto" className="font-ui text-muted text-xs italic mt-1">{form.example}</p>}
              {typeof form.addedBy === 'object' && form.addedBy?.cognitoSub !== ownerSub && speakerCredit(form.addedBy, labelFor) && (
                <p className="text-[10px] font-ui text-muted/50 mt-1">Added by {speakerCredit(form.addedBy, labelFor)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
