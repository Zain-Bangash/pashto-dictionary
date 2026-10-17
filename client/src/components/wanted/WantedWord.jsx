import { Link } from 'react-router-dom';
import useLookups from '../../hooks/useLookups';

// A word already published for the concept elsewhere, with a shortcut to add it for the selected region
export default function WantedWord({ word, conceptId, region }) {
  const { labelFor } = useLookups();
  const params = new URLSearchParams({ conceptId, pashto: word.pashto, ...(word.phonetic && { phonetic: word.phonetic }), region });
  const regionLabel = labelFor('region', region);

  return (
    <li className="py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span dir="rtl" className="font-pashto text-warm text-2xl">{word.pashto}</span>
          {word.phonetic && <span className="font-display italic text-gold text-sm">{word.phonetic}</span>}
        </div>
        <p className="text-xs font-ui text-muted">{word.regions.map((r) => labelFor('region', r)).join(' · ')}</p>
      </div>
      <Link
        to={`/submit?${params.toString()}`}
        className="shrink-0 font-ui text-xs text-warm/80 border border-white/[0.1] rounded-full px-3.5 py-1.5 hover:text-warm hover:border-white/20 transition-colors"
      >
        Also spoken in {regionLabel}
      </Link>
    </li>
  );
}
