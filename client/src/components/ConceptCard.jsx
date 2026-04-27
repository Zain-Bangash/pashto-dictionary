import { Link } from 'react-router-dom';

export default function ConceptCard({ concept }) {
  const variantCount = concept.variantCount ?? 0;

  return (
    <Link
      to={`/entries/${concept._id}`}
      className="bento-card block bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5 no-underline"
    >
      <p className="text-warm text-xl font-display font-semibold leading-snug">{concept.englishGloss}</p>
      {concept.partOfSpeech && (
        <span className="meta-label mt-1 inline-block">{concept.partOfSpeech}</span>
      )}
      <p className="text-muted text-xs font-ui mt-2">
        {variantCount} regional variant{variantCount !== 1 ? 's' : ''}
      </p>
    </Link>
  );
}
