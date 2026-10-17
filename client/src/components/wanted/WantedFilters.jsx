import RegionPills from '../RegionPills';
import SearchBar from '../SearchBar';
import LookupSelect from '../LookupSelect';
import DomainFilter from '../DomainFilter';
import useLookups from '../../hooks/useLookups';

const SELECT = 'bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-terracotta/60';

// Region, search, part of speech and domain for a Wanted tab; children add that tab's own filters
export default function WantedFilters({ region, filters, update, placeholder, children }) {
  const { active } = useLookups();
  const hasDomains = active('semanticDomain').length > 0;

  return (
    <div className="bg-white/[0.035] backdrop-blur-[32px] border border-white/[0.08] rounded-3xl p-4 sm:p-5 space-y-4">
      <RegionPills value={region} onChange={(key) => update({ region: key })} />
      <SearchBar key={filters.q} initialValue={filters.q} onSubmit={(q) => update({ q })} placeholder={placeholder} />
      <div className="flex items-center gap-3 flex-wrap">
        <LookupSelect
          type="partOfSpeech"
          aria-label="Filter by part of speech"
          value={filters.partOfSpeech}
          onChange={(e) => update({ partOfSpeech: e.target.value })}
          placeholder="All parts of speech"
          className={SELECT}
          optionClassName="bg-charcoal"
        />
        {children}
      </div>
      {hasDomains && <DomainFilter value={filters.domain} onChange={(domain) => update({ domain })} />}
    </div>
  );
}
