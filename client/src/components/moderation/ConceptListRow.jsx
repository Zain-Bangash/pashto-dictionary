import useLookups from '../../hooks/useLookups';
import ConceptManagePanel from './ConceptManagePanel';

const STATUS_COLORS = {
  pending:   { color: '#e8c547', bg: 'rgba(232,197,71,0.08)',  border: 'rgba(232,197,71,0.3)' },
  approved:  { color: '#00f5b4', bg: 'rgba(0,245,180,0.08)',   border: 'rgba(0,245,180,0.3)' },
  published: { color: '#00f5b4', bg: 'rgba(0,245,180,0.08)',   border: 'rgba(0,245,180,0.3)' },
  rejected:  { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)' },
};

// Admins manage any concept that is not rejected; rejected ones belong to their submitter to resubmit
export default function ConceptListRow({ concept, isAdmin, expanded, canMerge, onToggle, onMerge, onConceptEdited, onConceptRejected }) {
  const { labelFor } = useLookups();
  const s = STATUS_COLORS[concept.status] ?? STATUS_COLORS.pending;
  const manageable = isAdmin && concept.status !== 'rejected';

  return (
    <li className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-4">
      <div
        onClick={manageable ? onToggle : undefined}
        className={`flex items-center justify-between gap-3 ${manageable ? 'cursor-pointer' : ''}`}
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
              className="px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] transition-colors"
            >
              Manage
            </button>
          )}
          {isAdmin && canMerge && (
            <button
              onClick={onMerge}
              className="px-3 py-1.5 bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-ui font-semibold rounded-[8px] hover:bg-amber-400/20 transition-colors"
            >
              Merge
            </button>
          )}
          <span
            className="text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
            style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
            data-testid="status-badge"
          >
            {concept.status}
          </span>
        </div>
      </div>
      {manageable && expanded && (
        <ConceptManagePanel concept={concept} onConceptEdited={onConceptEdited} onConceptRejected={onConceptRejected} />
      )}
    </li>
  );
}
