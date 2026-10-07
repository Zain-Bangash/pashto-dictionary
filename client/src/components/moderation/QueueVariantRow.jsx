import { useState } from 'react';
import VariantEditForm from './VariantEditForm';
import { APPROVE_BTN, REJECT_BTN, PUBLISH_BTN, EDIT_BTN } from './queueButtons';

function approveBlockReason(conceptStatus) {
  if (conceptStatus === 'pending')  return 'Approve the concept first';
  if (conceptStatus === 'rejected') return 'Concept was rejected';
  return null;
}

export default function QueueVariantRow({ variant, concept, isAdmin, conflicts, onAction, onReject, onSave }) {
  const [editing, setEditing] = useState(false);
  const approveBlocked = approveBlockReason(concept.status);
  const publishBlocked = concept.status !== 'published' ? 'Publish the concept first' : null;
  const hint = variant.status === 'pending' ? approveBlocked : variant.status === 'approved' && isAdmin ? publishBlocked : null;

  return (
    <li className="bg-white/[0.025] border border-white/[0.06] rounded-[14px] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <div dir="rtl" className="font-pashto text-warm text-2xl leading-[1.7]">{variant.pashto}</div>
            {variant.phonetic && <span className="font-ui text-sm text-muted">/{variant.phonetic}/</span>}
            <span className="font-ui text-xs px-2 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded-full text-muted/70">
              {variant.region}
            </span>
          </div>
          {conflicts?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {conflicts.map((c) => (
                <span key={c.conceptId} className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  ⚠ Also under: {c.englishGloss} ({c.status})
                </span>
              ))}
            </div>
          )}
          <p className="text-sm font-ui text-muted">{variant.definition}</p>
          {variant.example && <p className="text-xs font-ui text-muted/60 italic">{variant.example}</p>}
          {variant.submissionNote && (
            <div className="mt-1 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-[10px]">
              <p className="text-[10px] font-ui font-semibold text-muted uppercase tracking-wider mb-1">Submitter note</p>
              <p className="text-xs font-ui text-muted/80 break-words">{variant.submissionNote}</p>
            </div>
          )}
          <p className="text-xs font-ui text-muted/60">
            by {variant.submittedBy?.username}
            {(variant.submittedBy?.village || variant.submittedBy?.region) && (
              <span className="ml-1">({[variant.submittedBy.village, variant.submittedBy.region].filter(Boolean).join(', ')})</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex gap-2">
            {variant.status === 'pending' && (
              <>
                <button onClick={() => onAction('variants', variant._id, 'approved')} disabled={!!approveBlocked} className={APPROVE_BTN}>
                  Approve
                </button>
                <button onClick={() => onReject('variants', variant._id)} className={REJECT_BTN}>Reject</button>
              </>
            )}
            {variant.status === 'approved' && isAdmin && (
              <button onClick={() => onAction('variants', variant._id, 'published')} disabled={!!publishBlocked} className={PUBLISH_BTN}>
                Publish
              </button>
            )}
            <button onClick={() => setEditing((e) => !e)} className={EDIT_BTN}>Edit</button>
          </div>
          {hint && <p className="text-[11px] font-ui text-amber-300/80">{hint}</p>}
        </div>
      </div>
      {editing && (
        <VariantEditForm
          item={{ ...variant, concept }}
          onSave={(updated) => { setEditing(false); onSave(updated); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </li>
  );
}
