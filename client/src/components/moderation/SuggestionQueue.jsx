import { useState } from 'react';
import { getSuggestionQueue, transitionSuggestion } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Pagination from '../Pagination';
import RejectModal from './RejectModal';
import SuggestionGroup from './SuggestionGroup';
import QueueToolbar from './QueueToolbar';
import BulkBar from './BulkBar';
import ActionError from './ActionError';
import useQueueParams, { activeFilters } from '../../hooks/useQueueParams';
import useQueueData from '../../hooks/useQueueData';
import useBulkActions from '../../hooks/useBulkActions';
import useSharedStats from '../../hooks/useSharedStats';
import useToast from '../../hooks/useToast';

const VERBS = { approved: 'Suggestion approved', published: 'Suggestion published', rejected: 'Suggestion rejected' };

const itemOf = (s, variant) => ({ id: s._id, label: `${variant?.pashto ?? 'Removed word'} — by ${s.submittedBy?.username ?? 'unknown'}` });

export default function SuggestionQueue() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const toast = useToast();
  const stats = useSharedStats();
  const { status, page, filters, filtering, update } = useQueueParams(isAdmin);

  const key = JSON.stringify([status, page, filters]);
  const { items, meta, loaded, loading, error, refresh } =
    useQueueData(() => getSuggestionQueue({ status, page, ...activeFilters(filters) }), key, 'Failed to load suggestions');
  const [actionError, setActionError] = useState(null);
  const [rejectId, setRejectId]       = useState(null);

  const afterChange = () => { refresh(); stats?.refresh?.(); };
  const bulk = useBulkActions({
    resetKey: key,
    perform: (item, next, note) => transitionSuggestion(item.id, { status: next, ...(note && { moderatorNote: note }) }),
    onDone: afterChange,
  });

  const act = async (id, body) => {
    setActionError(null);
    try {
      await transitionSuggestion(id, body);
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
  const selectable = items.flatMap((g) => g.suggestions.filter((s) => s.status === status).map((s) => itemOf(s, g.variant)));

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
        <p className="text-muted font-ui text-sm">{filtering ? 'Nothing matches these filters.' : 'No suggestions waiting.'}</p>
      ) : (
        <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {items.map((group) => (
            <SuggestionGroup
              key={group.variant?._id ?? group.suggestions[0]?._id}
              group={group}
              isAdmin={isAdmin}
              selection={bulk.selection}
              itemOf={itemOf}
              onFilterUser={(username) => update({ user: username })}
              onApprove={(id) => act(id, { status: 'approved' })}
              onPublish={(id) => act(id, { status: 'published' })}
              onReject={setRejectId}
              onSaved={() => { toast('Suggestion saved'); refresh(); }}
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
          warning={`This note goes to every selected suggestion (${bulk.selection.count}).`}
          onConfirm={(note) => bulk.run('rejected', note)}
          onCancel={bulk.cancelReject}
        />
      )}
    </div>
  );
}
