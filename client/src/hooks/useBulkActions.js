import { useState } from 'react';
import useSelection from './useSelection';
import useToast from './useToast';
import { runBulk, bulkSummary } from '../utils/bulk';

const VERBS = { approved: 'Approved', published: 'Published', rejected: 'Rejected' };

// Selection plus approve / publish / reject on every selected item. `perform(item, status, note)` sends one
// request; `order(items, status)` may reorder or drop items (for example variants cascaded by their concept).
// Items that fail stay selected and are listed with their reason.
export default function useBulkActions({ resetKey, perform, order = (items) => items, onDone }) {
  const selection = useSelection(resetKey);
  const toast = useToast();
  const [state, setState] = useState({ key: resetKey, busy: false, failures: [], rejecting: false });
  if (state.key !== resetKey) setState({ key: resetKey, busy: false, failures: [], rejecting: false });

  const run = async (status, note) => {
    const items = order(selection.list, status);
    const skipped = selection.count - items.length;
    setState((s) => ({ ...s, busy: true, failures: [], rejecting: false }));
    const failures = await runBulk(items, (item) => perform(item, status, note));
    selection.keepOnly(failures.map((f) => f.id));
    setState((s) => ({ ...s, busy: false, failures }));
    toast(bulkSummary(VERBS[status], items.length + skipped, failures.length), { tone: failures.length ? 'error' : 'success' });
    onDone?.();
  };

  return {
    selection,
    busy: state.busy,
    failures: state.key === resetKey ? state.failures : [],
    rejecting: state.rejecting,
    askReject: () => setState((s) => ({ ...s, rejecting: true })),
    cancelReject: () => setState((s) => ({ ...s, rejecting: false })),
    run,
  };
}
