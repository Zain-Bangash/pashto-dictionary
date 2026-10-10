import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyAudio, withdrawAudio } from '../../services/api';
import useLookups from '../../hooks/useLookups';
import Pagination from '../Pagination';
import StatusBadge from '../submissions/StatusBadge';
import AudioPlayButton from './AudioPlayButton';
import { audioSlotLabel } from '../../utils/audio';

const CARD = 'bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-4';
const HEADING = 'text-xs font-ui font-semibold text-muted uppercase tracking-widest mb-3';
const BADGE = { pending: 'pending', approved: 'approved', published: 'published', rejected: 'rejected', retired: 'rejected', withdrawn: 'rejected' };
const STATUS_TEXT = { retired: 'replaced', withdrawn: 'withdrawn' };

export default function MyRecordings() {
  const { labelFor } = useLookups();
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], total: 0, limit: 20, error: null });
  const [actionError, setActionError] = useState(null);

  const key = `${page}|${refreshKey}`;
  useEffect(() => {
    let cancelled = false;
    getMyAudio({ page })
      .then((res) => {
        if (!cancelled) setResult({ key, items: res.data.data || [], total: res.data.meta?.total ?? 0, limit: res.data.meta?.limit ?? 20, error: null });
      })
      .catch(() => { if (!cancelled) setResult((r) => ({ ...r, key, error: 'Could not load your recordings.' })); });
    return () => { cancelled = true; };
  }, [key, page]);

  const loading = result.key !== key;
  if (loading && !result.items.length) return <p className="text-muted font-ui text-sm animate-pulse">Loading recordings…</p>;
  if (!loading && result.error) return <p className="text-red-400 font-ui text-sm">{result.error}</p>;
  if (!result.items.length) return null;

  const withdraw = async (id) => {
    setActionError(null);
    try {
      await withdrawAudio(id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err?.response?.data?.error?.message || 'Could not withdraw the recording');
    }
  };

  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <section>
      <h2 className={HEADING}>Your recordings</h2>
      {actionError && <p role="alert" className="mb-3 text-red-400 text-sm font-ui">{actionError}</p>}
      <ul className="space-y-3">
        {result.items.map((clip) => (
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
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </section>
  );
}
