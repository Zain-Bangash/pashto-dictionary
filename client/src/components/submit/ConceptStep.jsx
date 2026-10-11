import useLookups from '../../hooks/useLookups';
import useConceptSuggestions from '../../hooks/useConceptSuggestions';
import { inputClass, labelClass } from './submitStyles';

const ROW = 'w-full text-left px-4 py-2.5 hover:bg-white/[0.05] transition-colors';

// Step 1: find the concept by English meaning, or start a new one
export default function ConceptStep({ glossQuery, onChange, onSelect, onCreateNew }) {
  const { labelFor } = useLookups();
  const suggestions = useConceptSuggestions(glossQuery);
  const createLabel = `+ Create new concept "${glossQuery}"`;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="glossQuery" className={labelClass}>English Meaning</label>
        <input
          id="glossQuery"
          type="text"
          value={glossQuery}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder="e.g. sun, water, house…"
          autoComplete="off"
        />
        <p className="text-muted font-ui text-xs mt-1.5">Type to search for an existing concept or create a new one.</p>
      </div>

      {suggestions.length > 0 && (
        <ul className="bg-black/60 border border-white/[0.08] rounded-[16px] overflow-hidden divide-y divide-white/[0.05]">
          {suggestions.map((c) => (
            <li key={c._id}>
              <button type="button" onClick={() => onSelect(c)} className={ROW}>
                <span className="text-warm text-sm font-ui">{c.englishGloss}</span>
                <span className="ml-2 text-muted text-xs font-ui">{labelFor('partOfSpeech', c.partOfSpeech)}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={onCreateNew} className={`${ROW} text-terracotta text-sm font-ui`}>{createLabel}</button>
          </li>
        </ul>
      )}

      {glossQuery.trim() && suggestions.length === 0 && (
        <button
          type="button"
          onClick={onCreateNew}
          className="w-full text-left px-4 py-2.5 bg-black/40 border border-white/[0.08] rounded-[12px] text-terracotta text-sm font-ui hover:bg-white/[0.04] transition-colors"
        >
          {createLabel}
        </button>
      )}
    </div>
  );
}
