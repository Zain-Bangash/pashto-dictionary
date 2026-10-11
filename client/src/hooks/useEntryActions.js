import { useState } from 'react';
import useToast from './useToast';
import useAudioRetireConfirm from './useAudioRetireConfirm';
import { setStatus, mergeConcepts, labelOf } from '../utils/entryQueue';

const VERBS = { approved: 'Approved', published: 'Published', rejected: 'Rejected' };

// Single-item actions on the entries queue: status changes, reject/merge modals and inline saves.
export default function useEntryActions({ groups, setGroups, refresh, afterChange }) {
  const toast = useToast();
  const { send, dialog } = useAudioRetireConfirm();
  const [actionError, setActionError] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // { prefix, id, label }
  const [mergeModal, setMergeModal]   = useState(null); // { sourceItem, targetItem }

  const runAction = async (request, success, fallback) => {
    setActionError(null);
    try {
      await request();
      toast(success);
      afterChange();
    } catch (err) {
      setActionError(err?.response?.data?.error?.message || fallback);
    }
  };

  const changeStatus = (prefix, id, next) =>
    runAction(() => setStatus(prefix, id, { status: next }), `${VERBS[next]} “${labelOf(groups, prefix, id) ?? 'item'}”`, 'Action failed');

  const askReject = (prefix, id) => setRejectModal({ prefix, id, label: labelOf(groups, prefix, id) });

  const confirmReject = async (note) => {
    const { prefix, id, label } = rejectModal;
    setRejectModal(null);
    await runAction(() => setStatus(prefix, id, { status: 'rejected', moderatorNote: note }), `Rejected “${label ?? 'item'}”`, 'Action failed');
  };

  const askMerge = (targetItem, sourceItem) => setMergeModal({ sourceItem, targetItem });

  const confirmMerge = async (note) => {
    const { sourceItem, targetItem } = mergeModal;
    setMergeModal(null);
    await runAction(
      () => send((confirm) => mergeConcepts(sourceItem._id, { targetConceptId: targetItem._id, note, ...confirm })),
      `Merged “${sourceItem.englishGloss}” into “${targetItem.englishGloss}”`,
      'Merge failed'
    );
  };

  const saveConcept = (updated) => {
    setGroups((prev) => prev.map((g) => (g._id === updated._id ? { ...g, ...updated, variants: g.variants } : g)));
    toast(`Saved “${updated.englishGloss}”`);
  };

  const saveVariant = (groupId, updated) => {
    toast(`Saved ${updated.pashto ?? 'the word'}`);
    const movedTo = updated.concept?._id || updated.concept;
    if (movedTo && String(movedTo) !== String(groupId)) return refresh();
    setGroups((prev) => prev.map((g) => (g._id !== groupId ? g : {
      ...g,
      variants: g.variants.map((v) => (v._id === updated._id ? { ...v, ...updated, concept: v.concept } : v)),
    })));
  };

  return {
    actionError, clearError: () => setActionError(null),
    rejectModal, askReject, confirmReject, cancelReject: () => setRejectModal(null),
    mergeModal, askMerge, confirmMerge, cancelMerge: () => setMergeModal(null),
    changeStatus, saveConcept, saveVariant, dialog,
  };
}
