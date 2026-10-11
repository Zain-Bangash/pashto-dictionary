import useLookups from '../../hooks/useLookups';
import ConceptManagePanel from './ConceptManagePanel';
import StatusBadge from '../submissions/StatusBadge';
import { EDIT_BTN } from './queueButtons';


// Admins manage any concept that is not rejected; rejected ones belong to their submitter to resubmit
export default function ConceptListRow({ concept, isAdmin, expanded, canMerge, onToggle, onMerge, onConceptEdited, onConceptRejected }) {
  const { labelFor } = useLookups();
  const manageable = isAdmin && concept.status !== 'rejected';

  return (
    <li className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-4">
      <div
        onClick={manageable ? onToggle : undefined}
        className={`flex flex-wrap items-center justify-between gap-3 ${manageable ? 'cursor-pointer' : ''}`}
      >
        <div className="flex flex-col gap-0.5 overflow-hidden">
          <p className="text-warm font-display font-semibold text-lg">{concept.englishGloss}</p>
          {concept.partOfSpeech && (
            <p className="text-sm font-ui text-muted truncate">{labelFor('partOfSpeech', concept.partOfSpeech)}</p>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 shrink-0">
          {manageable && (
            <button
              onClick={onToggle}
              aria-expanded={expanded}
              className={EDIT_BTN}
            >
              Manage
            </button>
          )}
          {isAdmin && canMerge && (
            <button
              onClick={onMerge}
              className={EDIT_BTN}
            >
              Merge
            </button>
          )}
          <span data-testid="status-badge"><StatusBadge status={concept.status} /></span>
        </div>
      </div>
      {manageable && expanded && (
        <ConceptManagePanel concept={concept} onConceptEdited={onConceptEdited} onConceptRejected={onConceptRejected} />
      )}
    </li>
  );
}
