import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getMySuggestions, resubmitSuggestion } from '../../services/api';
import useLookups from '../../hooks/useLookups';
import usePagedList, { MY_PAGE_SIZE } from '../../hooks/usePagedList';
import useListFilters from '../../hooks/useListFilters';
import Pagination from '../Pagination';
import StatusBadge from './StatusBadge';
import ContributeFormsForm from '../forms/ContributeFormsForm';
import { StatusChips, EmptyList } from './SubmissionFilters';
import { formKindFor, formSlot, slotLabel, sortForms } from '../../utils/forms';

const CARD = 'bg-white/[0.035] border border-white/[0.08] rounded-[16px] p-4';
const LINK_BTN = 'mt-2 self-start text-xs font-ui font-semibold text-terracotta hover:opacity-80 transition-opacity';

function SuggestionItem({ suggestion, onResubmitted }) {
  const { labelFor } = useLookups();
  const [editing, setEditing] = useState(false);
  const { variant, proposed = {}, status } = suggestion;

  return (
    <li className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <Link to={`/concepts/${variant.concept?._id}`} className="hover:opacity-80">
            <span dir="rtl" className="font-pashto text-warm text-lg">{variant.pashto}</span>
            <span className="ml-2 text-xs font-ui text-muted">{variant.concept?.englishGloss}</span>
          </Link>
          <span className="meta-label inline-block">{labelFor('region', variant.region)}</span>
          <ul className="mt-1 space-y-0.5">
            {sortForms(proposed.forms).map((f) => (
              <li key={formSlot(f)} className="text-xs font-ui text-muted">
                <span className="text-muted/50">{slotLabel(formSlot(f))}: </span>
                <span dir="rtl" className="font-pashto text-warm/90 text-sm">{f.pashto}</span>
              </li>
            ))}
          </ul>
          {status === 'rejected' && suggestion.moderatorNote && (
            <p className="text-xs font-ui text-red-400 mt-1">Note: {suggestion.moderatorNote}</p>
          )}
          {status === 'rejected' && variant.status === 'published' && !editing && (
            <button onClick={() => setEditing(true)} className={LINK_BTN}>Edit &amp; resubmit</button>
          )}
          {editing && (
            <ContributeFormsForm
              kind={formKindFor(variant.concept?.partOfSpeech)}
              liveForms={variant.forms ?? []}
              initialForms={(proposed.forms ?? []).filter((f) => !(variant.forms ?? []).some((v) => formSlot(v) === formSlot(f)))}
              idPrefix={`resubmit-${suggestion._id}`}
              submitLabel="Resubmit suggestion"
              onSubmit={async (forms) => {
                await resubmitSuggestion(suggestion._id, { forms });
                setEditing(false);
                onResubmitted();
              }}
              onCancel={() => setEditing(false)}
            />
          )}
        </div>
        <StatusBadge status={status} />
      </div>
    </li>
  );
}

const fetchSuggestions = (params) => getMySuggestions({ scope: 'others', ...params });

// Suggestions the user sent for other people's words; suggestions on their own words show on the word's row
export default function MySuggestions({ counts, status = '', onStatusChange, onMutated = () => {} }) {
  const { filters, setPage } = useListFilters({}, status);
  const { items, totalPages, loading, loaded, error, reload } = usePagedList(
    fetchSuggestions, { status, page: filters.page, limit: MY_PAGE_SIZE }, 'Could not load your suggestions.'
  );

  return (
    <>
      <StatusChips counts={counts} value={status} onChange={onStatusChange} />
      {!loaded ? (
        <p className="text-muted font-ui text-sm animate-pulse">Loading suggestions…</p>
      ) : error ? (
        <p role="alert" className="text-red-400 font-ui text-sm">{error}</p>
      ) : items.length === 0 ? (
        <EmptyList>{status ? 'No suggestions match this status.' : 'You have not suggested anything yet.'}</EmptyList>
      ) : (
        <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {items.map((s) => (
            <SuggestionItem key={s._id} suggestion={s} onResubmitted={() => { reload(); onMutated(); }} />
          ))}
        </ul>
      )}
      {totalPages > 1 && <Pagination page={filters.page} totalPages={totalPages} onPageChange={setPage} />}
    </>
  );
}
