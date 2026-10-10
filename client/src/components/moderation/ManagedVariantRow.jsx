import { useState } from 'react';
import { Link } from 'react-router-dom';
import VariantEditForm from './VariantEditForm';
import { REJECT_BTN, EDIT_BTN } from './queueButtons';
import useLookups from '../../hooks/useLookups';
import { proposedFields } from '../../utils/suggestions';
import PublishedClips from '../audio/PublishedClips';

// onReject is only passed for published words; entries still in review are approved or rejected from the queue
export default function ManagedVariantRow({ variant, concept, openSuggestions = [], onReject, onSave }) {
  const { labelFor } = useLookups();
  const [editing, setEditing] = useState(false);

  return (
    <li className="bg-white/[0.025] border border-white/[0.06] rounded-[14px] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <div dir="rtl" className="font-pashto text-warm text-2xl leading-[1.7]">{variant.pashto}</div>
            {variant.phonetic && <span className="font-ui text-sm text-muted">/{variant.phonetic}/</span>}
            <span className="font-ui text-xs px-2 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded-full text-muted/70">
              {labelFor('region', variant.region)}
            </span>
          </div>
          <p className="text-sm font-ui text-muted">{variant.definition}</p>
          {variant.example && <p className="text-xs font-ui text-muted/60 italic">{variant.example}</p>}
          {openSuggestions.length > 0 && (
            <p className="text-[11px] font-ui text-amber-300/90">
              {openSuggestions.length === 1 ? `Suggestion ${openSuggestions[0].status}` : `${openSuggestions.length} open suggestions`} — the fields they propose are locked here.{' '}
              <Link to="/dashboard/queue?view=suggestions" className="underline hover:text-amber-200">Review it in Suggestions</Link>
            </p>
          )}
          {variant.submittedBy?.username && (
            <p className="text-xs font-ui text-muted/60">by {variant.submittedBy.username}</p>
          )}
          <PublishedClips variant={variant} />
        </div>
        <div className="flex gap-2 shrink-0">
          {onReject && <button onClick={() => onReject(variant)} aria-label={`Reject variant ${variant.pashto}`} className={REJECT_BTN}>Reject</button>}
          <button onClick={() => setEditing((e) => !e)} aria-label={`Edit variant ${variant.pashto}`} className={EDIT_BTN}>Edit</button>
        </div>
      </div>
      {editing && (
        <VariantEditForm
          item={{ ...variant, concept }}
          lockedFields={openSuggestions.flatMap(proposedFields)}
          onSave={(updated) => { setEditing(false); onSave(updated); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </li>
  );
}
