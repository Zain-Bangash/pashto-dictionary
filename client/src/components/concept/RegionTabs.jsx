import useLookups from '../../hooks/useLookups';

const TAB = 'text-xs font-ui px-3 py-1 rounded-full transition-all border';
const ON = 'bg-mint/[0.12] border-mint/35 text-mint';
const OFF = 'bg-white/[0.04] border-white/[0.08] text-muted hover:text-warm';

// One tab per region that uses this spelling; the selected one is the active state (mint)
export default function RegionTabs({ group, activeIdx, onSelect }) {
  const { labelFor } = useLookups();
  return (
    <div role="group" aria-label="Regions" className="flex gap-2 flex-wrap">
      {group.map((v, idx) => (
        <button
          key={v._id}
          type="button"
          aria-pressed={activeIdx === idx}
          onClick={() => onSelect(idx)}
          className={`${TAB} ${activeIdx === idx ? ON : OFF}`}
        >
          {labelFor('region', v.region)}
        </button>
      ))}
    </div>
  );
}
