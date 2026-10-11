// Runs one request per item, in order, so the state machine and the log stay per item.
// Returns the items that failed, each with the server's reason.
export async function runBulk(items, perform) {
  const failed = [];
  for (const item of items) {
    try {
      await perform(item);
    } catch (err) {
      failed.push({ ...item, message: err?.response?.data?.error?.message || 'Failed' });
    }
  }
  return failed;
}

export function bulkSummary(verb, total, failedCount) {
  const done = total - failedCount;
  const items = (n) => `${n} item${n === 1 ? '' : 's'}`;
  return failedCount ? `${verb} ${items(done)}; ${failedCount} failed` : `${verb} ${items(done)}`;
}
