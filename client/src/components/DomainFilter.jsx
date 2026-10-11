import useLookups from '../hooks/useLookups';

const PILL = 'font-ui text-xs px-3 py-1.5 rounded-full border transition-all';
const ON = 'bg-mint/15 border-mint/40 text-mint';
const OFF = 'bg-white/[0.04] border-white/[0.08] text-muted hover:text-warm';

// Clicking the selected domain again clears the filter
export default function DomainFilter({ value, onChange }) {
  const { active } = useLookups();
  const options = active('semanticDomain');
  if (options.length === 0) return null;

  return (
    <div role="group" aria-label="Filter by domain" className="flex gap-2 flex-wrap">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(value === o.key ? '' : o.key)}
          className={`${PILL} ${value === o.key ? ON : OFF}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
