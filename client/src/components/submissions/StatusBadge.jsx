// Gold = waiting, mint = approved or live (the design rule for mint), red = rejected
const STATUS_STYLES = {
  pending:   'text-gold border-gold/30 bg-gold/[0.08]',
  approved:  'text-mint border-mint/30 bg-mint/[0.08]',
  published: 'text-mint border-mint/30 bg-mint/[0.08]',
  rejected:  'text-red-400 border-red-400/30 bg-red-400/[0.08]',
};

export default function StatusBadge({ status, label }) {
  return (
    <span className={`shrink-0 text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider border ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}>
      {label ?? status}
    </span>
  );
}
