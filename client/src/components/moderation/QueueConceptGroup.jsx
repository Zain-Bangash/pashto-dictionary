import { useState } from 'react';
import ConceptEditForm from './ConceptEditForm';
import SimilarConceptsPanel from './SimilarConceptsPanel';
import QueueVariantRow from './QueueVariantRow';
import { APPROVE_BTN, REJECT_BTN, PUBLISH_BTN, EDIT_BTN } from './queueButtons';
import useLookups from '../../hooks/useLookups';
import ExtraFieldsDisplay from '../fields/ExtraFieldsDisplay';

export default function QueueConceptGroup({ group, isAdmin, crossConceptMap, showSimilar, onAction, onReject, onConceptSave, onVariantSave, onMergeRequest }) {
  const { labelFor } = useLookups();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing]   = useState(false);

  const { variants = [], ...concept } = group;
  const conceptRef = { _id: concept._id, englishGloss: concept.englishGloss, status: concept.status, partOfSpeech: concept.partOfSpeech };
  const count = variants.length;
  const panelId = `variants-${concept._id}`;

  return (
    <li className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-5">
      <div
        onClick={count > 0 ? () => setExpanded((x) => !x) : undefined}
        className={`flex items-start justify-between gap-4 ${count > 0 ? 'cursor-pointer' : ''}`}
      >
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-warm font-display text-lg font-semibold">{concept.englishGloss}</p>
            <span className="font-ui text-[10px] px-1.5 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded-full text-muted/80">
              {concept.status}
            </span>
          </div>
          <p className="text-sm font-ui text-muted">{labelFor('partOfSpeech', concept.partOfSpeech)}</p>
          <ExtraFieldsDisplay appliesTo="concept" values={concept.extra} />
          <p className="text-xs font-ui text-muted/60">
            by {concept.submittedBy?.username}
            {(concept.submittedBy?.village || concept.submittedBy?.region) && (
              <span className="ml-1">({[concept.submittedBy.village, labelFor('region', concept.submittedBy.region)].filter(Boolean).join(', ')})</span>
            )}
          </p>
        </div>
        <div onClick={(e) => e.stopPropagation()} className="flex gap-2 shrink-0">
          {concept.status === 'pending' && (
            <>
              <button onClick={() => onAction('concepts', concept._id, 'approved')} className={APPROVE_BTN}>Approve</button>
              <button onClick={() => onReject('concepts', concept._id)} className={REJECT_BTN}>Reject</button>
            </>
          )}
          {concept.status === 'approved' && isAdmin && (
            <button onClick={() => onAction('concepts', concept._id, 'published')} className={PUBLISH_BTN}>Publish</button>
          )}
          <button onClick={() => setEditing((e) => !e)} className={EDIT_BTN}>Edit</button>
        </div>
      </div>

      {editing && (
        <ConceptEditForm
          item={concept}
          onSave={(updated) => { setEditing(false); onConceptSave(updated); }}
          onCancel={() => setEditing(false)}
        />
      )}

      {showSimilar && concept.status === 'pending' && (
        <SimilarConceptsPanel item={concept} onMergeRequest={onMergeRequest} />
      )}

      {count === 0 ? (
        <p className="mt-3 text-xs font-ui text-muted/50">No variants waiting</p>
      ) : (
        <button
          onClick={() => setExpanded((x) => !x)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="mt-3 flex items-center gap-1.5 text-xs font-ui font-semibold text-muted hover:text-warm transition-colors"
        >
          <span className={`inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
          {count} {count === 1 ? 'variant' : 'variants'} waiting
        </button>
      )}

      {expanded && count > 0 && (
        <section id={panelId} aria-label={`Variants of ${concept.englishGloss}`} className="mt-3 pl-4 border-l border-white/[0.08]">
          <ul className="space-y-2">
            {variants.map((v) => (
              <QueueVariantRow
                key={v._id}
                variant={v}
                concept={conceptRef}
                isAdmin={isAdmin}
                conflicts={crossConceptMap[v._id]}
                onAction={onAction}
                onReject={onReject}
                onSave={(updated) => onVariantSave(concept._id, updated)}
              />
            ))}
          </ul>
        </section>
      )}
    </li>
  );
}
