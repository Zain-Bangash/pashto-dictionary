import useLookups from '../hooks/useLookups';

const PILL = 'font-ui text-xs px-3 py-1.5 rounded-full border transition-all';
const ACTIVE = 'bg-mint/15 border-mint/40 text-mint';
const INACTIVE = 'bg-white/[0.04] border-white/[0.08] text-muted hover:text-warm';

export default function RegionPills({ value, onChange, label = 'Region' }) {
  const { active } = useLookups();
  return (
    <div role="group" aria-label={label} className="flex gap-2 flex-wrap">
      {active('region').map((r) => (
        <button
          key={r.key}
          type="button"
          aria-pressed={value === r.key}
          onClick={() => onChange(r.key)}
          className={`${PILL} ${value === r.key ? ACTIVE : INACTIVE}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
