import { useAuth } from '../../context/AuthContext';
import Pagination from '../Pagination';
import RejectModal from './RejectModal';
import MergeModal from './MergeModal';
import QueueConceptGroup from './QueueConceptGroup';
import QueueToolbar from './QueueToolbar';
import BulkBar from './BulkBar';
import ActionError from './ActionError';
import useQueueParams from '../../hooks/useQueueParams';
import useQueueData from '../../hooks/useQueueData';
import useBulkActions from '../../hooks/useBulkActions';
import useSharedStats from '../../hooks/useSharedStats';
import useCrossConceptConflicts from '../../hooks/useCrossConceptConflicts';
import useEntryActions from '../../hooks/useEntryActions';
import { getQueue, setStatus, orderEntries, selectableItems } from '../../utils/entryQueue';

export default function EntryQueue() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const stats = useSharedStats();
  const { status, page, filters, filtering, update } = useQueueParams(isAdmin);

  const key = JSON.stringify([status, page, filters]);
  const { items: groups, setItems: setGroups, meta, loaded, loading, error, refresh } =
    useQueueData(() => getQueue(status, page, filters), key, 'Failed to load queue');
  const crossConceptMap = useCrossConceptConflicts(groups);

  const afterChange = () => { refresh(); stats?.refresh?.(); };
  const actions = useEntryActions({ groups, setGroups, refresh, afterChange });
  const bulk = useBulkActions({
    resetKey: key,
    perform: (item, next, note) => setStatus(item.prefix, item.id, { status: next, ...(note && { moderatorNote: note }) }),
    order: orderEntries,
    onDone: afterChange,
  });

  if (!loaded && loading) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error) return <div className="text-red-400 font-ui text-sm">{error}</div>;

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 20)));
  const { mergeModal } = actions;

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
        selectable={selectableItems(groups, status)}
        selection={bulk.selection}
      />

      <ActionError message={actions.actionError} onDismiss={actions.clearError} />

      {groups.length === 0 ? (
        <p className="text-muted font-ui text-sm">{filtering ? 'Nothing matches these filters.' : 'Nothing in the queue.'}</p>
      ) : (
        <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {groups.map((g) => (
            <QueueConceptGroup
              key={g._id}
              group={g}
              isAdmin={isAdmin}
              queueStatus={status}
              crossConceptMap={crossConceptMap}
              showSimilar={!mergeModal}
              selection={bulk.selection}
              onFilterUser={(username) => update({ user: username })}
              onAction={actions.changeStatus}
              onReject={actions.askReject}
              onConceptSave={actions.saveConcept}
              onVariantSave={actions.saveVariant}
              onMergeRequest={actions.askMerge}
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

      {actions.rejectModal && <RejectModal onConfirm={actions.confirmReject} onCancel={actions.cancelReject} />}
      {bulk.rejecting && (
        <RejectModal
          warning={`This note goes to every selected item (${bulk.selection.count}). Rejecting a concept also rejects its words.`}
          onConfirm={(note) => bulk.run('rejected', note)}
          onCancel={bulk.cancelReject}
        />
      )}

      {mergeModal && (
        <MergeModal
          sourceItem={mergeModal.sourceItem}
          targetItem={mergeModal.targetItem}
          onConfirm={actions.confirmMerge}
          onCancel={actions.cancelMerge}
        />
      )}
      {actions.dialog}
    </div>
  );
}
