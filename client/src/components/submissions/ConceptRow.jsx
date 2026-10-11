import { useState } from 'react';
import useLookups from '../../hooks/useLookups';
import StatusBadge from './StatusBadge';
import ConceptResubmitForm from './ConceptResubmitForm';

export default function ConceptRow({ concept, onSaved }) {
  const { labelFor } = useLookups();
  const [editing, setEditing] = useState(false);
  return (
    <li className="bg-white/[0.035] border border-white/[0.08] rounded-[16px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 overflow-hidden">
          <p className="text-warm font-display text-lg font-semibold">{concept.englishGloss}</p>
          {concept.partOfSpeech && <span className="meta-label inline-block">{labelFor('partOfSpeech', concept.partOfSpeech)}</span>}
          {concept.status === 'rejected' && concept.moderatorNote && (
            <p className="text-xs font-ui text-red-400 mt-1">Note: {concept.moderatorNote}</p>
          )}
          {concept.status === 'rejected' && !editing && (
            <button onClick={() => setEditing(true)} className="mt-2 self-start text-xs font-ui font-semibold text-terracotta hover:opacity-80 transition-opacity">
              Edit &amp; Resubmit
            </button>
          )}
          {editing && (
            <ConceptResubmitForm concept={concept} onSave={(updated) => { setEditing(false); onSaved(updated); }} onCancel={() => setEditing(false)} />
          )}
        </div>
        <StatusBadge status={concept.status} />
      </div>
    </li>
  );
}
