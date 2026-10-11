import { useState } from 'react';
import useLookups from '../../hooks/useLookups';
import SuggestionEditForm from './SuggestionEditForm';
import { APPROVE_BTN, REJECT_BTN, PUBLISH_BTN, EDIT_BTN } from './queueButtons';
import EditDiff from './EditDiff';
import SelectBox from './SelectBox';

// compact: shown inside a SuggestionGroup, which already shows the word
export default function SuggestionRow({ suggestion, compact = false, isAdmin, selected = false, onSelect, onFilterUser, onApprove, onReject, onPublish, onSaved }) {
  const { labelFor } = useLookups();
  const [editing, setEditing] = useState(false);
  const { variant, proposed = {}, status } = suggestion;
  const canEdit = isAdmin && ['pending', 'approved'].includes(status);
  const proposer = suggestion.submittedBy?.username;
  const byOwner = Boolean(proposer) && suggestion.submittedBy?.cognitoSub === variant?.submittedBy?.cognitoSub;

  return (
    <li className={compact ? 'bg-white/[0.025] border border-white/[0.06] rounded-[14px] p-4' : 'bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-5'}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {onSelect && <SelectBox checked={selected} onChange={onSelect} label={`Select suggestion by ${proposer ?? 'unknown'}`} />}
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            {compact ? null : variant ? (
              <>
                <p className="text-warm font-display text-lg font-semibold">{variant.concept?.englishGloss}</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div dir="rtl" className="font-pashto text-warm text-2xl">{variant.pashto}</div>
                  {variant.phonetic && <span className="font-ui text-sm text-muted">/{variant.phonetic}/</span>}
                  <span className="font-ui text-xs px-2 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded-full text-muted/70">
                    {labelFor('region', variant.region)}
                  </span>
                </div>
                <p className="text-sm font-ui text-muted">{variant.definition}</p>
              </>
            ) : (
              <p className="text-sm font-ui text-muted italic">The word is no longer available</p>
            )}

            <EditDiff
              variant={variant}
              proposed={proposed}
              baseline={suggestion.baseline}
              heading={`Proposed by ${proposer ?? 'unknown'}${byOwner ? " (the word's submitter)" : ''}`}
            />
            {onFilterUser && proposer && (
              <button
                type="button"
                onClick={() => onFilterUser(proposer)}
                className="self-start text-[11px] font-ui text-muted/60 underline decoration-dotted underline-offset-2 hover:text-warm transition-colors"
              >
                Show only {proposer}'s submissions
              </button>
            )}
        </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {status === 'pending' && (
            <>
              <button onClick={() => onApprove(suggestion._id)} className={APPROVE_BTN}>Approve</button>
              <button onClick={() => onReject(suggestion._id)} className={REJECT_BTN}>Reject</button>
            </>
          )}
          {status === 'approved' && isAdmin && (
            <>
              <button onClick={() => onPublish(suggestion._id)} className={PUBLISH_BTN}>Publish</button>
              <button onClick={() => onReject(suggestion._id)} className={REJECT_BTN}>Reject</button>
            </>
          )}
          {canEdit && <button onClick={() => setEditing((e) => !e)} className={EDIT_BTN}>Edit</button>}
        </div>
      </div>

      {editing && (
        <SuggestionEditForm
          suggestion={suggestion}
          onSave={() => { setEditing(false); onSaved(); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </li>
  );
}
