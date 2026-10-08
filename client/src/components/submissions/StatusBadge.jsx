const STATUS_STYLES = {
  pending:   { color: '#e8c547', border: 'rgba(232,197,71,0.3)',  bg: 'rgba(232,197,71,0.08)' },
  approved:  { color: '#00f5b4', border: 'rgba(0,245,180,0.3)',   bg: 'rgba(0,245,180,0.08)' },
  published: { color: '#00f5b4', border: 'rgba(0,245,180,0.3)',   bg: 'rgba(0,245,180,0.08)' },
  rejected:  { color: '#f87171', border: 'rgba(248,113,113,0.3)', bg: 'rgba(248,113,113,0.08)' },
};

export default function StatusBadge({ status, label }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className="shrink-0 text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {label ?? status}
    </span>
  );
}
