import { Link } from 'react-router-dom';
import useLookups from '../hooks/useLookups';
import useTilt from '../hooks/useTilt';
import ListenButton from './audio/ListenButton';

// Word card for Home and Browse: the whole card links to the concept, Listen plays the first word's recording
export default function ConceptCard({ concept }) {
  const { labelFor } = useLookups();
  const { ref: tiltRef, onMouseMove, onMouseLeave } = useTilt();
  const word = concept.firstVariant ?? null;
  const count = concept.variantCount ?? 0;
  const more = concept.moreWordCount ?? 0;
  const glossLink = (
    <Link to={`/concepts/${concept._id}`} className="no-underline after:absolute after:inset-0 after:content-['']">
      {concept.englishGloss}
    </Link>
  );

  return (
    <article
      ref={tiltRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      data-testid="card"
      className="bento-card relative h-full flex flex-col overflow-hidden bg-white/[0.03] backdrop-blur-[24px] border border-white/[0.07] border-l-2 border-l-terracotta/50 rounded-[16px]"
    >
      <div className="p-4 sm:p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2
            dir="ltr"
            className={word
              ? 'font-display italic text-gold text-base sm:text-lg leading-snug line-clamp-2 min-w-0'
              : 'font-display text-warm font-bold text-xl min-w-0'}
          >
            {glossLink}
          </h2>
          {concept.partOfSpeech && (
            <span className="font-ui text-warm/50 border border-white/[0.1] rounded-md text-[9px] px-1.5 py-0.5 shrink-0 mt-1 uppercase tracking-wider">
              {labelFor('partOfSpeech', concept.partOfSpeech)}
            </span>
          )}
        </div>

        {word && (
          <>
            <div className="flex items-center justify-between gap-3">
              {more > 0 && (
                <span className="font-ui text-muted text-xs shrink-0">+ {more} more word{more !== 1 ? 's' : ''}</span>
              )}
              <div dir="rtl" data-testid="card-pashto" className="pashto-bloom font-pashto text-warm font-bold text-2xl sm:text-3xl min-w-0 ml-auto">
                {word.pashto}
              </div>
            </div>
            <div className="h-px bg-white/[0.06]" />
            {word.example && (
              <p dir="rtl" className="font-pashto text-warm/45 text-sm line-clamp-2">{word.example}</p>
            )}
          </>
        )}
      </div>

      <div className="relative z-10 pointer-events-none border-t border-white/[0.05] px-4 sm:px-5 py-2.5 flex items-center justify-between gap-2 min-h-11">
        <span className="font-ui text-muted text-xs">
          {count} regional variant{count !== 1 ? 's' : ''}
        </span>
        <ListenButton clip={word?.audio} label={`Listen to ${word?.pashto ?? concept.englishGloss}`} className="pointer-events-auto" />
      </div>
    </article>
  );
}
