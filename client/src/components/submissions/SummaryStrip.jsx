const KINDS = ['concepts', 'variants', 'audio', 'suggestions'];
const TILES = [
  ['pending', 'Pending', 'bg-gold'],
  ['approved', 'Approved', 'bg-mint'],
  ['published', 'Published', 'bg-mint'],
  ['rejected', 'Rejected', 'bg-red-400'],
];

// Totals across concepts, variants, recordings and suggestions; picking one opens every section that has any
export default function SummaryStrip({ summary, onPick }) {
  return (
    <div role="group" aria-label="Submission summary" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {TILES.map(([status, label, dot]) => {
        const count = KINDS.reduce((sum, kind) => sum + (summary[kind]?.[status] ?? 0), 0);
        return (
          <button
            key={status}
            type="button"
            disabled={count === 0}
            onClick={() => onPick(status)}
            aria-label={`${label}: ${count}`}
            className="text-left bg-white/[0.035] border border-white/[0.08] rounded-[16px] px-4 py-3 hover:border-white/[0.2] hover:bg-white/[0.05] transition-all disabled:opacity-50 disabled:hover:border-white/[0.08] disabled:hover:bg-white/[0.035] disabled:cursor-default"
          >
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
              <span className="meta-label">{label}</span>
            </span>
            <span className="block font-display text-2xl text-warm mt-1" aria-hidden="true">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
