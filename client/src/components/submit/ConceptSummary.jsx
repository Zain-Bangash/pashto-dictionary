import useLookups from '../../hooks/useLookups';

export default function ConceptSummary({ gloss, partOfSpeech, isNew, onChange }) {
  const { labelFor } = useLookups();
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] border-l-2 border-l-terracotta/50 rounded-[16px] px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="meta-label mb-1">{isNew ? 'New concept' : 'Concept'}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-warm font-display text-lg">{gloss}</p>
          {partOfSpeech && (
            <span className="font-ui text-warm/50 border border-white/[0.1] rounded-md text-[9px] px-1.5 py-0.5 uppercase tracking-wider">
              {labelFor('partOfSpeech', partOfSpeech)}
            </span>
          )}
        </div>
      </div>
      <button type="button" onClick={onChange} className="shrink-0 text-muted text-xs font-ui hover:text-warm transition-colors">
        Change
      </button>
    </div>
  );
}
