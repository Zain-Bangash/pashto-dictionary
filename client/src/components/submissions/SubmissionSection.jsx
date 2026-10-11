// One collapsible section of My Submissions. Closed by default; its list only loads once opened.
export default function SubmissionSection({ id, title, total, attention = 0, open, onToggle, children }) {
  const panelId = `submissions-${id}`;
  return (
    <section className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px]">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left rounded-[20px] hover:bg-white/[0.03] transition-colors"
        >
          <span className="flex items-center gap-3 flex-wrap min-w-0">
            <span className="font-display text-lg text-warm">{title}</span>
            {total !== undefined && (
              <span className="font-ui text-[11px] font-semibold text-warm/70 bg-white/[0.06] border border-white/[0.1] rounded-full px-2.5 py-0.5">
                {total}
              </span>
            )}
            {attention > 0 && (
              <span className="font-ui text-[10px] font-semibold uppercase tracking-wider text-red-400 bg-red-400/[0.08] border border-red-400/30 rounded-full px-2.5 py-0.5">
                {attention} rejected
              </span>
            )}
          </span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true" className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h2>
      {open && (
        <div id={panelId} className="px-5 pb-5 pt-4 space-y-3 border-t border-white/[0.06]">
          {children}
        </div>
      )}
    </section>
  );
}
