import LookupSelect from '../LookupSelect';
import useFieldDefinitions from '../../hooks/useFieldDefinitions';

const SELECT = 'bg-[#1c1c15] border border-white/[0.15] rounded-[8px] px-3 py-1.5 text-xs font-ui text-warm focus:outline-none focus:border-terracotta/50';
const CHIP = 'font-ui text-xs px-3 py-1.5 rounded-full border transition-all';

const CORE_OPTIONS = [
  ['', 'Any missing detail'],
  ['phonetic', 'Phonetic'],
  ['example', 'Example'],
  ['forms', 'Forms (none yet)'],
  ['forms_partial', 'Forms: some empty'],
];

export default function CompletionFilters({ count, completion, missing, region, onChange }) {
  const { forType } = useFieldDefinitions();
  const optionalFields = forType('variant').filter((d) => !d.required);

  return (
    <div className="flex items-center gap-2 flex-wrap mb-3">
      {(count > 0 || completion) && (
        <button
          type="button"
          aria-pressed={completion}
          onClick={() => onChange({ completion: !completion, missing: '' })}
          className={`${CHIP} ${completion ? 'bg-mint/15 border-mint/40 text-mint' : 'bg-white/[0.04] border-white/[0.08] text-muted hover:text-warm'}`}
        >
          Needs completion ({count})
        </button>
      )}
      {completion && (
        <select aria-label="Missing detail" value={missing} onChange={(e) => onChange({ missing: e.target.value })} className={SELECT}>
          {CORE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          {optionalFields.map((d) => <option key={d.key} value={`extra.${d.key}`}>{d.label}</option>)}
        </select>
      )}
      <LookupSelect
        type="region"
        aria-label="Filter by region"
        value={region}
        onChange={(e) => onChange({ region: e.target.value })}
        placeholder="All regions"
        className={SELECT}
      />
    </div>
  );
}
