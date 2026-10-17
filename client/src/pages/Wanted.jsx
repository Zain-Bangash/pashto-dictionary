import { Link } from 'react-router-dom';
import useLookups from '../hooks/useLookups';
import useWantedParams from '../hooks/useWantedParams';
import useWantedList from '../hooks/useWantedList';
import { getWanted } from '../services/api';
import WantedTabs from '../components/wanted/WantedTabs';
import WantedFilters from '../components/wanted/WantedFilters';
import WantedResults from '../components/wanted/WantedResults';
import WantedConceptRow from '../components/wanted/WantedConceptRow';
import WantedWord from '../components/wanted/WantedWord';

const ADD = 'shrink-0 font-ui font-semibold text-warm bg-terracotta rounded-xl text-xs px-4 py-2 hover:opacity-90 transition-opacity';

export default function Wanted() {
  const { labelFor } = useLookups();
  const { region, page, filters, update } = useWantedParams(['partOfSpeech', 'domain']);
  const list = useWantedList(getWanted, { region, page, ...filters }, 'Failed to load wanted words.');
  const regionLabel = labelFor('region', region);

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-3xl mx-auto px-5 py-10 space-y-6">
        <div className="bento-enter space-y-4">
          <div>
            <h1 className="text-2xl font-display text-warm">Wanted Words</h1>
            <p className="text-sm font-ui text-muted mt-1">
              Meanings that still need a word from your region. Open one to see the words used elsewhere.
            </p>
          </div>
          <WantedTabs current="words" region={region} q={filters.q} />
        </div>

        <WantedFilters region={region} filters={filters} update={update} placeholder="Search English meanings…" />

        <WantedResults
          list={list}
          page={page}
          onPageChange={(p) => update({ page: String(p) })}
          emptyText={`Nothing wanted${region ? ` for ${regionLabel}` : ''}${filters.q ? ` matching “${filters.q}”` : ''}.`}
          countText={`${list.total} wanted in ${regionLabel}`}
        >
          {list.items.map((c) => (
            <WantedConceptRow
              key={c._id}
              concept={c}
              count={`${c.words.length} word${c.words.length !== 1 ? 's' : ''} elsewhere`}
              action={(
                <Link to={`/submit?${new URLSearchParams({ conceptId: c._id, region })}`} className={ADD}>
                  Add your {regionLabel} word
                </Link>
              )}
            >
              {c.words.length > 0 ? (
                <ul className="divide-y divide-white/[0.06]">
                  {c.words.map((w) => <WantedWord key={w.pashto} word={w} conceptId={c._id} region={region} />)}
                </ul>
              ) : (
                <p className="text-sm font-ui text-muted py-2">No words yet. Be the first to add one.</p>
              )}
            </WantedConceptRow>
          ))}
        </WantedResults>
      </div>
    </div>
  );
}
