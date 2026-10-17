import useLookups from '../hooks/useLookups';
import useWantedParams from '../hooks/useWantedParams';
import useWantedList from '../hooks/useWantedList';
import { getWantedAudio } from '../services/api';
import WantedTabs from '../components/wanted/WantedTabs';
import WantedFilters from '../components/wanted/WantedFilters';
import WantedResults from '../components/wanted/WantedResults';
import WantedConceptRow from '../components/wanted/WantedConceptRow';
import WantedAudioWord from '../components/wanted/WantedAudioWord';

const MISSING = [['', 'All'], ['headword', 'Word'], ['example', 'Example']];
const PILL = 'font-ui text-xs px-3 py-1.5 rounded-full border transition-all';
const ON = 'bg-mint/15 border-mint/40 text-mint';
const OFF = 'bg-white/[0.04] border-white/[0.08] text-muted hover:text-warm';

export default function WantedAudio() {
  const { labelFor } = useLookups();
  const { region, page, filters, update } = useWantedParams(['slot', 'partOfSpeech', 'domain']);
  const list = useWantedList(getWantedAudio, { region, page, ...filters }, 'Failed to load wanted recordings.');
  const regionLabel = labelFor('region', region);

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-3xl mx-auto px-5 py-10 space-y-6">
        <div className="bento-enter space-y-4">
          <div>
            <h1 className="text-2xl font-display text-warm">Wanted Audio</h1>
            <p className="text-sm font-ui text-muted mt-1">
              Words from your region that nobody has recorded yet. Open one and record the word or its example.
            </p>
          </div>
          <WantedTabs current="audio" region={region} q={filters.q} />
        </div>

        <WantedFilters region={region} filters={filters} update={update} placeholder="Search English, Pashto or phonetic…">
          <div role="group" aria-label="Missing recording" className="flex gap-2 items-center">
            <span className="meta-label">Missing</span>
            {MISSING.map(([key, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={filters.slot === key}
                onClick={() => update({ slot: key })}
                className={`${PILL} ${filters.slot === key ? ON : OFF}`}
              >
                {label}
              </button>
            ))}
          </div>
        </WantedFilters>

        <WantedResults
          list={list}
          page={page}
          onPageChange={(p) => update({ page: String(p) })}
          emptyText={`No recordings wanted${region ? ` for ${regionLabel}` : ''}${filters.q ? ` matching “${filters.q}”` : ''}.`}
          countText={`${list.total} concept${list.total !== 1 ? 's' : ''} need recordings in ${regionLabel}`}
        >
          {list.items.map((c) => (
            <WantedConceptRow
              key={c._id}
              concept={c}
              count={`${c.words.length} word${c.words.length !== 1 ? 's' : ''} to record`}
            >
              <ul className="divide-y divide-white/[0.06]">
                {c.words.map((w) => <WantedAudioWord key={w.variantId} word={w} conceptId={c._id} />)}
              </ul>
            </WantedConceptRow>
          ))}
        </WantedResults>
      </div>
    </div>
  );
}
