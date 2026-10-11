import SearchBar from '../SearchBar';
import DomainFilter from '../DomainFilter';
import RegionPills from '../RegionPills';
import useLookups from '../../hooks/useLookups';

// Search, domain and region for the Browse page; every value lives in the URL
export default function BrowseFilters({ q, domain, region, onChange }) {
  const { active } = useLookups();
  const hasDomains = active('semanticDomain').length > 0;

  return (
    <div className="search-card bento-card bg-white/[0.035] backdrop-blur-[32px] border border-white/[0.08] rounded-3xl p-4 sm:p-5 space-y-4">
      <SearchBar key={q} initialValue={q} onSubmit={(next) => onChange({ q: next })} />
      <div className="space-y-2">
        <p className="meta-label">Region</p>
        <RegionPills value={region} onChange={(next) => onChange({ region: next })} label="Filter by region" clearable />
      </div>
      {hasDomains && (
        <div className="space-y-2">
          <p className="meta-label">Domain</p>
          <DomainFilter value={domain} onChange={(next) => onChange({ domain: next })} />
        </div>
      )}
    </div>
  );
}
