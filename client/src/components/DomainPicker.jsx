import useLookups from '../hooks/useLookups';

const PILL = 'font-ui text-xs px-3 py-1.5 rounded-full border transition-all';
const ON = 'bg-mint/15 border-mint/40 text-mint';
const OFF = 'bg-white/[0.04] border-white/[0.08] text-muted hover:text-warm';

// Several domains can be picked; a deactivated one already chosen stays visible so it can be removed
export default function DomainPicker({ value = [], onChange, label = 'Domains', labelClassName, hint }) {
  const { active, labelFor } = useLookups();
  const options = active('semanticDomain');
  const retired = value.filter((k) => !options.some((o) => o.key === k));
  if (options.length === 0 && retired.length === 0) return null;

  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div>
      <p className={labelClassName}>{label}</p>
      {hint && <p className="text-[11px] font-ui text-muted/60 mb-2">{hint}</p>}
      <div role="group" aria-label={label} className="flex gap-2 flex-wrap">
        {[...options.map((o) => o.key), ...retired].map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={value.includes(key)}
            onClick={() => toggle(key)}
            className={`${PILL} ${value.includes(key) ? ON : OFF}`}
          >
            {labelFor('semanticDomain', key)}
            {retired.includes(key) && ' (retired)'}
          </button>
        ))}
      </div>
    </div>
  );
}
