import { useState } from 'react';
import useLookups from '../../hooks/useLookups';
import useFieldDefinitions from '../../hooks/useFieldDefinitions';
import SuggestionEditForm from './SuggestionEditForm';
import { APPROVE_BTN, REJECT_BTN, PUBLISH_BTN, EDIT_BTN } from './queueButtons';
import { formSlot, slotLabel, sortForms } from '../../utils/forms';

function Proposed({ label, value }) {
  return (
    <p className="text-xs font-ui text-muted">
      <span className="text-muted/50">{label}: </span>
      <span className="text-muted/40 italic">blank</span>
      <span className="text-muted/40 mx-1">→</span>
      <span dir="auto" className="text-warm/90">{value}</span>
    </p>
  );
}

export default function SuggestionRow({ suggestion, isAdmin, userId, onApprove, onReject, onPublish, onSaved }) {
  const { labelFor } = useLookups();
  const { fieldLabel } = useFieldDefinitions();
  const [editing, setEditing] = useState(false);
  const { variant, proposed = {}, status } = suggestion;
  const own = Boolean(userId) && String(suggestion.submittedBy?._id) === String(userId);
  const canEdit = isAdmin ? ['pending', 'approved'].includes(status) : status === 'pending' && !own;

  return (
    <li className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {variant ? (
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

          <section aria-label="Proposed details" className="mt-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-[10px] space-y-1">
            <p className="text-[10px] font-ui font-semibold text-muted uppercase tracking-wider">Proposed by the submitter</p>
            {proposed.phonetic && <Proposed label="Phonetic" value={proposed.phonetic} />}
            {proposed.example && <Proposed label="Example" value={proposed.example} />}
            {Object.entries(proposed.extra ?? {}).map(([key, value]) => (
              <Proposed key={key} label={fieldLabel('variant', key)} value={value} />
            ))}
            {sortForms(proposed.forms).map((f) => (
              <Proposed
                key={formSlot(f)}
                label={`Form (${slotLabel(formSlot(f))})`}
                value={[f.pashto, f.phonetic && `/${f.phonetic}/`, f.example].filter(Boolean).join(' · ')}
              />
            ))}
          </section>

          <p className="text-xs font-ui text-muted/60">by {suggestion.submittedBy?.username}</p>
        </div>

        <div className="flex gap-2 shrink-0">
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
