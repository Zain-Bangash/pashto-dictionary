import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyAudio, withdrawAudio } from '../../services/api';
import useLookups from '../../hooks/useLookups';
import usePagedList, { MY_PAGE_SIZE } from '../../hooks/usePagedList';
import useListFilters from '../../hooks/useListFilters';
import Pagination from '../Pagination';
import StatusBadge from '../submissions/StatusBadge';
import { StatusChips, EmptyList } from '../submissions/SubmissionFilters';
import { REVIEW_OPTIONS, SELECT } from '../submissions/filterOptions';
import AudioPlayButton from './AudioPlayButton';
import { audioSlotLabel } from '../../utils/audio';

const CARD = 'bg-white/[0.035] border border-white/[0.08] rounded-[16px] p-4';
const BADGE = { pending: 'pending', approved: 'approved', published: 'published', rejected: 'rejected', retired: 'rejected', withdrawn: 'rejected' };
const STATUS_TEXT = { retired: 'replaced', withdrawn: 'withdrawn' };
const STATUS_OPTIONS = [...REVIEW_OPTIONS, ['retired', 'Replaced'], ['withdrawn', 'Withdrawn']];
const SLOTS = [['', 'All recordings'], ['headword', 'Words'], ['example', 'Example sentences'], ['form', 'Forms']];

const fetchRecordings = (params) => getMyAudio(params);

export default function MyRecordings({ counts, status = '', onStatusChange, onMutated = () => {} }) {
  const { labelFor } = useLookups();
  const { filters, change, setPage } = useListFilters({ slot: '' }, status);
  const [actionError, setActionError] = useState(null);
  const { items, totalPages, loading, loaded, error, reload } = usePagedList(
    fetchRecordings, { status, slot: filters.slot, page: filters.page, limit: MY_PAGE_SIZE }, 'Could not load your recordings.'
  );
  const filtering = Boolean(status || filters.slot);

  const withdraw = async (id) => {
    setActionError(null);
    try {
      await withdrawAudio(id);
      reload();
      onMutated();
    } catch (err) {
      setActionError(err?.response?.data?.error?.message || 'Could not withdraw the recording');
    }
  };

  return (
    <>
      <StatusChips options={STATUS_OPTIONS} counts={counts} value={status} onChange={onStatusChange} />
      <select aria-label="Filter by recording type" value={filters.slot} onChange={(e) => change({ slot: e.target.value })} className={SELECT}>
        {SLOTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {actionError && <p role="alert" className="text-red-400 text-sm font-ui">{actionError}</p>}
      {!loaded ? (
        <p className="text-muted font-ui text-sm animate-pulse">Loading recordings…</p>
      ) : error ? (
        <p role="alert" className="text-red-400 font-ui text-sm">{error}</p>
      ) : items.length === 0 ? (
        <EmptyList>{filtering ? 'No recordings match these filters.' : 'You have not recorded anything yet.'}</EmptyList>
      ) : (
        <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {items.map((clip) => (
            <li key={clip._id} className={CARD}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <AudioPlayButton clip={clip} label="Play your recording" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-ui text-muted uppercase tracking-wider">
                      {audioSlotLabel(clip.slot)}
                      {clip.variant && <> · {labelFor('region', clip.variant.region)}</>}
                    </p>
                    {clip.variant ? (
                      <Link to={`/concepts/${clip.variant.concept?._id}`} className="block hover:opacity-80">
                        <span dir="rtl" className="font-pashto text-warm text-lg">{clip.slotText || clip.variant.pashto}</span>
                        <span className="ml-2 text-xs font-ui text-muted">{clip.variant.concept?.englishGloss}</span>
                      </Link>
                    ) : (
                      <p className="text-xs font-ui text-muted italic">The word is no longer available</p>
                    )}
                    {clip.status === 'rejected' && clip.moderatorNote && (
                      <p className="text-xs font-ui text-red-400 mt-1">Note: {clip.moderatorNote}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={BADGE[clip.status] ?? 'pending'} label={STATUS_TEXT[clip.status]} />
                  {clip.status === 'pending' && (
                    <button onClick={() => withdraw(clip._id)} className="text-[11px] font-ui text-muted hover:text-red-400 transition-colors">
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && <Pagination page={filters.page} totalPages={totalPages} onPageChange={setPage} />}
    </>
  );
}
