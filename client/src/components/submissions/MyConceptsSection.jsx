import api from '../../services/api';
import usePagedList, { MY_PAGE_SIZE } from '../../hooks/usePagedList';
import useListFilters from '../../hooks/useListFilters';
import LookupSelect from '../LookupSelect';
import Pagination from '../Pagination';
import ConceptRow from './ConceptRow';
import { StatusChips, SearchBox, EmptyList } from './SubmissionFilters';
import { SELECT } from './filterOptions';

const fetchConcepts = (params) => api.get('/api/concepts/my-submissions', { params });

export default function MyConceptsSection({ counts, status, onStatusChange, onMutated }) {
  const { filters, change, setPage } = useListFilters({ q: '', partOfSpeech: '' }, status);
  const { items, setItems, totalPages, loading, loaded, error } = usePagedList(
    fetchConcepts, { status, q: filters.q, partOfSpeech: filters.partOfSpeech, page: filters.page, limit: MY_PAGE_SIZE }, 'Could not load your concepts.'
  );
  const filtering = Boolean(status || filters.q || filters.partOfSpeech);

  return (
    <>
      <StatusChips counts={counts} value={status} onChange={onStatusChange} />
      <div className="flex items-center gap-2 flex-wrap">
        <SearchBox label="Search my concepts" value={filters.q} onChange={(q) => change({ q })} />
        <LookupSelect
          type="partOfSpeech"
          aria-label="Filter concepts by part of speech"
          value={filters.partOfSpeech}
          onChange={(e) => change({ partOfSpeech: e.target.value })}
          placeholder="All parts of speech"
          className={SELECT}
        />
      </div>
      {!loaded ? (
        <p className="text-muted font-ui text-sm animate-pulse">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-red-400 font-ui text-sm">{error}</p>
      ) : items.length === 0 ? (
        <EmptyList>{filtering ? 'No concepts match these filters.' : 'You have not submitted any concepts.'}</EmptyList>
      ) : (
        <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {items.map((c) => (
            <ConceptRow
              key={c._id}
              concept={c}
              onSaved={(u) => { setItems((prev) => prev.map((x) => (x._id === u._id ? u : x))); onMutated(); }}
            />
          ))}
        </ul>
      )}
      {totalPages > 1 && <Pagination page={filters.page} totalPages={totalPages} onPageChange={setPage} />}
    </>
  );
}
