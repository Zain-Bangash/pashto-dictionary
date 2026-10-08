import { useState } from 'react';
import { transitionConceptStatus, transitionVariantStatus } from '../../services/api';
import usePublishedConcept from '../../hooks/usePublishedConcept';
import useOpenSuggestions from '../../hooks/useOpenSuggestions';
import ConceptEditForm from './ConceptEditForm';
import RejectModal from './RejectModal';
import PublishedVariantRow from './PublishedVariantRow';
import { REJECT_BTN, EDIT_BTN } from './queueButtons';

function cascadeWarning(count) {
  if (count === 0) return null;
  if (count === 1) return 'Its 1 variant will also be rejected.';
  return `All ${count} variants will also be rejected.`;
}

export default function PublishedConceptPanel({ concept, onConceptEdited, onConceptRejected }) {
  const { variants, setVariants, loading, error } = usePublishedConcept(concept._id);
  const openSuggestions = useOpenSuggestions(concept._id);
  const [editing, setEditing]           = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [actionError, setActionError]   = useState(null);

  const conceptRef = { _id: concept._id, englishGloss: concept.englishGloss, partOfSpeech: concept.partOfSpeech };

  const handleRejectConfirm = async (note) => {
    const target = rejectTarget;
    setRejectTarget(null);
    setActionError(null);
    const body = { status: 'rejected', moderatorNote: note };
    try {
      if (target.type === 'concept') {
        await transitionConceptStatus(concept._id, body);
        onConceptRejected();
      } else {
        await transitionVariantStatus(target.variant._id, body);
        setVariants((vs) => vs.filter((v) => v._id !== target.variant._id));
      }
    } catch (err) {
      setActionError(err?.response?.data?.error?.message || 'Reject failed');
    }
  };

  const handleVariantSave = (updated) => {
    setVariants((vs) =>
      String(updated.concept?._id ?? updated.concept) === concept._id
        ? vs.map((v) => (v._id === updated._id ? { ...v, ...updated } : v))
        : vs.filter((v) => v._id !== updated._id)
    );
  };

  return (
    <section aria-label={`Manage ${concept.englishGloss}`} className="mt-4 pl-4 border-l border-white/[0.08] space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-ui font-semibold text-muted uppercase tracking-wider">Published concept</p>
        <div className="flex gap-2">
          <button onClick={() => setRejectTarget({ type: 'concept' })} aria-label="Reject concept" className={REJECT_BTN}>Reject</button>
          <button onClick={() => setEditing((e) => !e)} aria-label="Edit concept" className={EDIT_BTN}>Edit</button>
        </div>
      </div>

      {editing && (
        <ConceptEditForm
          item={concept}
          onSave={(updated) => { setEditing(false); onConceptEdited(updated); }}
          onCancel={() => setEditing(false)}
        />
      )}

      {actionError && <p className="text-red-400 text-sm font-ui">{actionError}</p>}

      {loading ? (
        <p className="text-muted font-ui text-sm animate-pulse">Loading variants…</p>
      ) : error ? (
        <p className="text-red-400 font-ui text-sm">{error}</p>
      ) : variants.length === 0 ? (
        <p className="text-xs font-ui text-muted/50">No published variants</p>
      ) : (
        <ul className="space-y-2">
          {variants.map((v) => (
            <PublishedVariantRow
              key={v._id}
              variant={v}
              concept={conceptRef}
              openSuggestion={openSuggestions[v._id]}
              onReject={(variant) => setRejectTarget({ type: 'variant', variant })}
              onSave={handleVariantSave}
            />
          ))}
        </ul>
      )}

      {rejectTarget && (
        <RejectModal
          warning={rejectTarget.type === 'concept' ? cascadeWarning(variants.length) : null}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </section>
  );
}
