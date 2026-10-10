import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMySuggestions, resubmitSuggestion } from '../../services/api';
import useLookups from '../../hooks/useLookups';
import Pagination from '../Pagination';
import StatusBadge from './StatusBadge';
import ContributeFormsForm from '../forms/ContributeFormsForm';
import { formKindFor, formSlot, slotLabel, sortForms } from '../../utils/forms';

const CARD = 'bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-4';
const HEADING = 'text-xs font-ui font-semibold text-muted uppercase tracking-widest mb-3';
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

// Suggestions the user sent for other people's words; suggestions on their own words show on the word's row above
export default function MySuggestions() {
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], total: 0, limit: 20, error: null });

  const key = `${page}|${refreshKey}`;
  useEffect(() => {
    let cancelled = false;
    getMySuggestions({ scope: 'others', page })
      .then((res) => {
        if (!cancelled) setResult({ key, items: res.data.data || [], total: res.data.meta?.total ?? 0, limit: res.data.meta?.limit ?? 20, error: null });
      })
      .catch(() => { if (!cancelled) setResult((r) => ({ ...r, key, error: 'Could not load your suggestions.' })); });
    return () => { cancelled = true; };
  }, [key, page]);

  const loading = result.key !== key;
  if (loading && !result.items.length) return <p className="text-muted font-ui text-sm animate-pulse">Loading suggestions…</p>;
  if (!loading && result.error) return <p className="text-red-400 font-ui text-sm">{result.error}</p>;
  if (!result.items.length) return null;

  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <section>
      <h2 className={HEADING}>Forms you suggested</h2>
      <ul className="space-y-3">
        {result.items.map((s) => (
          <SuggestionItem key={s._id} suggestion={s} onResubmitted={() => setRefreshKey((k) => k + 1)} />
        ))}
      </ul>
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}
