import useMyVariants from '../../hooks/useMyVariants';
import useListFilters from '../../hooks/useListFilters';
import Pagination from '../Pagination';
import CompletionFilters from './CompletionFilters';
import MyVariantRow from './MyVariantRow';
import { StatusChips, SearchBox, EmptyList } from './SubmissionFilters';

export default function MyVariantsSection({ counts, status, onStatusChange, onMutated }) {
  const { filters, change, setPage } = useListFilters({ completion: false, missing: '', region: '', q: '' }, status);
  const { variants, setVariants, meta, loading, loaded, error, reload } = useMyVariants({ ...filters, status });
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const filtering = Boolean(status || filters.completion || filters.region || filters.q);

  // The completion list is always published words, so choosing it clears the status filter and the other way round
  const changeFilters = (changes) => {
    if (changes.completion) onStatusChange('');
    change(changes);
  };
  const changeStatus = (next) => {
    if (next && filters.completion) change({ completion: false, missing: '' });
    onStatusChange(next);
  };

  return (
    <>
      <StatusChips counts={counts} value={status} onChange={changeStatus} disabled={filters.completion} />
      <SearchBox label="Search my words" value={filters.q} onChange={(q) => change({ q })} />
      <CompletionFilters count={meta.needsCompletionCount} {...filters} onChange={changeFilters} />
      {!loaded ? (
        <p className="text-muted font-ui text-sm animate-pulse">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-red-400 font-ui text-sm">{error}</p>
      ) : variants.length === 0 ? (
        <EmptyList>
          {filters.completion ? 'Nothing needs completing.' : filtering ? 'No words match these filters.' : 'You have not submitted any words.'}
        </EmptyList>
      ) : (
        <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {variants.map((v) => (
            <MyVariantRow
              key={v._id}
              variant={v}
              onChanged={(u) => { setVariants((prev) => prev.map((x) => (x._id === u._id ? { ...x, ...u, concept: x.concept } : x))); onMutated(); }}
              onSuggested={() => { reload(); onMutated(); }}
            />
          ))}
        </ul>
      )}
      {totalPages > 1 && <Pagination page={filters.page} totalPages={totalPages} onPageChange={setPage} />}
    </>
  );
}
