import { useState } from 'react';
import { getAudioQueue, transitionAudio } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Pagination from '../Pagination';
import RejectModal from '../moderation/RejectModal';
import QueueToolbar from '../moderation/QueueToolbar';
import BulkBar from '../moderation/BulkBar';
import ActionError from '../moderation/ActionError';
import AudioQueueRow from './AudioQueueRow';
import useQueueParams, { activeFilters } from '../../hooks/useQueueParams';
import useQueueData from '../../hooks/useQueueData';
import useBulkActions from '../../hooks/useBulkActions';
import useSharedStats from '../../hooks/useSharedStats';
import useToast from '../../hooks/useToast';
import { audioSlotLabel } from '../../utils/audio';

const VERBS = { approved: 'Recording approved', published: 'Recording published', rejected: 'Recording rejected' };

const itemOf = (clip) => ({ id: clip._id, label: `${clip.variant?.pashto ?? 'Removed word'} — ${audioSlotLabel(clip.slot)}` });

export default function AudioQueue() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const toast = useToast();
  const stats = useSharedStats();
  const { status, page, filters, filtering, update } = useQueueParams(isAdmin);

  const key = JSON.stringify([status, page, filters]);
  const { items, meta, loaded, loading, error, refresh } =
    useQueueData(() => getAudioQueue({ status, page, ...activeFilters(filters) }), key, 'Failed to load recordings');
  const [actionError, setActionError] = useState(null);
  const [rejectId, setRejectId]       = useState(null);

  const afterChange = () => { refresh(); stats?.refresh?.(); };
  const bulk = useBulkActions({
    resetKey: key,
    perform: (item, next, note) => transitionAudio(item.id, { status: next, ...(note && { moderatorNote: note }) }),
    onDone: afterChange,
  });

  const act = async (id, body) => {
    setActionError(null);
    try {
      await transitionAudio(id, body);
      toast(VERBS[body.status]);
      afterChange();
    } catch (err) {
      setActionError(err?.response?.data?.error?.message || 'Action failed');
    }
  };

  const handleRejectConfirm = (note) => {
    const id = rejectId;
    setRejectId(null);
    act(id, { status: 'rejected', moderatorNote: note });
  };

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 20)));
  // A moderator cannot review their own recording, so it is never selectable for them
  const isOwn = (clip) => Boolean(user?.id) && String(clip.submittedBy?._id) === String(user.id);
  const selectable = items.filter((clip) => isAdmin || !isOwn(clip)).map(itemOf);

  return (
    <div>
      <QueueToolbar
        isAdmin={isAdmin}
        status={status}
        meta={meta}
        filters={filters}
        filtering={filtering}
        onChange={update}
        searchLabel="Search gloss or Pashto word"
        selectable={selectable}
        selection={bulk.selection}
      />

      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      {!loaded && loading ? (
        <p className="text-muted font-ui text-sm animate-pulse">Loading…</p>
      ) : error ? (
        <p className="text-red-400 font-ui text-sm">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-muted font-ui text-sm">{filtering ? 'Nothing matches these filters.' : 'No recordings waiting.'}</p>
      ) : (
        <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {items.map((clip) => (
            <AudioQueueRow
              key={clip._id}
              clip={clip}
              isAdmin={isAdmin}
              userId={user?.id}
              selected={bulk.selection.has(clip._id)}
              onSelect={() => bulk.selection.toggle(itemOf(clip))}
              onFilterUser={(username) => update({ user: username })}
              onApprove={(id) => act(id, { status: 'approved' })}
              onPublish={(id) => act(id, { status: 'published' })}
              onReject={setRejectId}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={(p) => update({ page: p })} />}

      <BulkBar
        count={bulk.selection.count}
        status={status}
        isAdmin={isAdmin}
        busy={bulk.busy}
        failures={bulk.failures}
        onApprove={() => bulk.run('approved')}
        onPublish={() => bulk.run('published')}
        onReject={bulk.askReject}
        onClear={bulk.selection.clear}
      />

      {rejectId && <RejectModal onConfirm={handleRejectConfirm} onCancel={() => setRejectId(null)} />}
      {bulk.rejecting && (
        <RejectModal
          warning={`This note goes to every selected recording (${bulk.selection.count}).`}
          onConfirm={(note) => bulk.run('rejected', note)}
          onCancel={bulk.cancelReject}
        />
      )}
    </div>
  );
}
