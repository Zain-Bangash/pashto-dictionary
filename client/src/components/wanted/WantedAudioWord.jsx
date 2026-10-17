import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const CHIP = 'shrink-0 font-ui text-xs font-semibold text-gold border border-gold/35 bg-gold/[0.06] rounded-full px-3 py-1 hover:bg-gold/[0.12] transition-colors';
const LABELS = { headword: '+ Word', example: '+ Example' };

// A word missing recordings; each chip opens the concept page with the recorder ready on that slot
export default function WantedAudioWord({ word, conceptId }) {
  const { user } = useAuth();

  const pathname = `/concepts/${conceptId}`;
  const searchFor = (slot) => `?${new URLSearchParams({ record: word.variantId, slot })}`;

  return (
    <li className="py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0 space-y-1">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span dir="rtl" className="font-pashto text-warm text-2xl">{word.pashto}</span>
          {word.phonetic && <span className="font-display italic text-gold text-sm">{word.phonetic}</span>}
        </div>
        {word.example && <p dir="rtl" className="font-pashto text-warm/55 text-base border-r-2 border-gold/30 pr-3">{word.example}</p>}
      </div>
      <div className="flex gap-2">
        {word.missing.map((slot) => (
          <Link
            key={slot}
            to={user ? `${pathname}${searchFor(slot)}` : '/login'}
            state={user ? undefined : { from: { pathname, search: searchFor(slot) } }}
            title={`Record the ${slot === 'headword' ? 'word' : 'example'} for ${word.pashto}`}
            className={CHIP}
          >
            {LABELS[slot]}
          </Link>
        ))}
      </div>
    </li>
  );
}
