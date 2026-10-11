import LookupSelect from '../LookupSelect';
import { StatusChips, SearchBox } from '../submissions/SubmissionFilters';
import { SELECT } from '../submissions/filterOptions';
import SelectBox from './SelectBox';

const STATUS_OPTIONS = [['pending', 'Pending'], ['approved', 'Approved']];

// Status chips (admins only), search, region and submitter filters, and select-all for bulk actions
export default function QueueToolbar({ isAdmin, status, meta, filters, filtering, onChange, searchLabel, selectable = [], selection }) {
  const allSelected = selectable.length > 0 && selectable.every((item) => selection.has(item.id));
  return (
    <div className="space-y-3 mb-5">
      {isAdmin && (
        <StatusChips
          options={STATUS_OPTIONS}
          counts={{ pending: meta.pendingCount ?? 0, approved: meta.approvedCount ?? 0 }}
          value={status}
          onChange={(s) => onChange({ status: s })}
          keepEmpty
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox label={searchLabel} value={filters.q} onChange={(q) => onChange({ q })} />
        <LookupSelect
          type="region"
          aria-label="Region"
          value={filters.region}
          onChange={(e) => onChange({ region: e.target.value })}
          placeholder="All regions"
          className={SELECT}
          optionClassName="bg-charcoal"
        />
        <SearchBox label="Submitter username" value={filters.user} onChange={(user) => onChange({ user })} className="sm:flex-none sm:w-44" />
        {filtering && (
          <button
            type="button"
            onClick={() => onChange({ q: '', region: '', user: '' })}
            className="text-xs font-ui text-muted hover:text-warm underline underline-offset-2 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
      {selection && selectable.length > 0 && (
        <label className="inline-flex items-center gap-2 text-xs font-ui text-muted cursor-pointer select-none">
          <SelectBox
            checked={allSelected}
            onChange={() => selection.setAll(selectable, !allSelected)}
            label={allSelected ? 'Clear selection on this page' : 'Select all on this page'}
          />
          Select all on this page ({selectable.length})
        </label>
      )}
    </div>
  );
}
