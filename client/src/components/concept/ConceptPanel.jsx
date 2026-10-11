import useLookups from '../../hooks/useLookups';
import DomainChips from '../DomainChips';
import ExtraFieldsDisplay from '../fields/ExtraFieldsDisplay';
import { speakerCredit } from '../../utils/audio';

// The concept itself: sticky beside the words on wide screens, above them on phones
export default function ConceptPanel({ concept, wordCount }) {
  const { labelFor } = useLookups();
  const regionCount = new Set((concept.variants ?? []).map((v) => v.region)).size;
  const submitter = speakerCredit(concept.submittedBy, labelFor);

  return (
    <div className="bg-white/[0.04] backdrop-blur-[32px] border border-white/[0.08] rounded-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-6 sm:p-8 space-y-4">
      <p className="meta-label">Concept</p>
      <h1 className="font-display text-warm text-4xl sm:text-5xl font-bold leading-tight break-words">{concept.englishGloss}</h1>
      <div className="flex items-center gap-3 flex-wrap">
        {concept.partOfSpeech && (
          <span className="font-ui text-warm/60 border border-white/[0.1] rounded-md text-[10px] px-2 py-0.5 uppercase tracking-wider">
            {labelFor('partOfSpeech', concept.partOfSpeech)}
          </span>
        )}
        {wordCount > 0 && (
          <span className="font-ui text-xs text-muted">
            {wordCount} word{wordCount !== 1 ? 's' : ''} · {regionCount} region{regionCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <DomainChips domains={concept.semanticDomains} />
      <ExtraFieldsDisplay appliesTo="concept" values={concept.extra} />
      {submitter && <p className="text-[11px] font-ui text-muted/60 pt-2 border-t border-white/[0.06]">Submitted by {submitter}</p>}
    </div>
  );
}
