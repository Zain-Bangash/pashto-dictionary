import { useState } from 'react';
import { transitionConceptStatus, transitionVariantStatus } from '../../services/api';
import useConceptVariants from '../../hooks/useConceptVariants';
import useOpenSuggestions from '../../hooks/useOpenSuggestions';
import ConceptEditForm from './ConceptEditForm';
import RejectModal from './RejectModal';
import ManagedVariantRow from './ManagedVariantRow';
import { REJECT_BTN, EDIT_BTN } from './queueButtons';

function cascadeWarning(count) {
  if (count === 0) return null;
  if (count === 1) return 'Its 1 variant will also be rejected.';
  return `All ${count} variants will also be rejected.`;
}

export default function ConceptManagePanel({ concept, onConceptEdited, onConceptRejected }) {
  const published = concept.status === 'published';
  const { variants, setVariants, loading, error } = useConceptVariants(concept);
  const openSuggestions = useOpenSuggestions(published ? concept._id : null);
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
        <p className="text-xs font-ui font-semibold text-muted uppercase tracking-wider">{concept.status} concept</p>
        <div className="flex gap-2">
          {published && <button onClick={() => setRejectTarget({ type: 'concept' })} aria-label="Reject concept" className={REJECT_BTN}>Reject</button>}
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
        <p className="text-xs font-ui text-muted/50">{published ? 'No published variants' : 'No variants under review'}</p>
      ) : (
        <ul className="space-y-2">
          {variants.map((v) => (
            <ManagedVariantRow
              key={v._id}
              variant={v}
              concept={conceptRef}
              openSuggestions={openSuggestions[v._id]}
              onReject={published ? (variant) => setRejectTarget({ type: 'variant', variant }) : undefined}
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
