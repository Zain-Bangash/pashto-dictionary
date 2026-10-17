import Pagination from '../Pagination';

// Loading, error, empty and paged states shared by the Wanted tabs
export default function WantedResults({ list, page, onPageChange, emptyText, countText, children }) {
  if (list.loading) return <p className="text-muted font-ui text-sm text-center py-16 animate-pulse">Loading…</p>;
  if (list.error) return <p role="alert" className="text-red-400 font-ui text-sm text-center py-16">{list.error}</p>;
  if (list.items.length === 0) return <p className="text-muted font-ui text-sm text-center py-16">{emptyText}</p>;

  return (
    <>
      <p className="meta-label">{countText}</p>
      <ul className="space-y-2">{children}</ul>
      {list.totalPages > 1 && <Pagination page={page} totalPages={list.totalPages} onPageChange={onPageChange} />}
    </>
  );
}
