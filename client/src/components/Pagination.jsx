const BTN = 'font-ui text-sm text-warm/70 border border-white/[0.1] rounded-xl px-4 py-2 hover:border-white/20 hover:text-warm transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/[0.1] disabled:hover:text-warm/70';

export default function Pagination({ page, totalPages, onPageChange }) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-4 mt-8">
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className={BTN}>
        Previous
      </button>
      <span className="font-ui text-muted text-sm tabular-nums">
        Page {page} of {totalPages}
      </span>
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className={BTN}>
        Next
      </button>
    </nav>
  );
}
