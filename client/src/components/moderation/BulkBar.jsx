import { PRIMARY_BTN, REJECT_BTN, EDIT_BTN } from './queueButtons';

// Sticky bar for acting on the selected items. Failures from the last run stay listed until the next one.
export default function BulkBar({ count, status, isAdmin, busy, failures, onApprove, onPublish, onReject, onClear }) {
  if (count === 0 && failures.length === 0) return null;
  const canPublish = isAdmin && status === 'approved';
  return (
    <div role="region" aria-label="Bulk actions" className="sticky bottom-4 z-20 mt-4 bg-charcoal/95 backdrop-blur-[24px] border border-white/[0.12] rounded-[16px] px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.45)] space-y-2">
      {count > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-ui text-sm text-warm mr-auto">{count} selected</span>
          {status === 'pending' && (
            <button type="button" disabled={busy} onClick={onApprove} className={PRIMARY_BTN}>Approve selected</button>
          )}
          {canPublish && (
            <button type="button" disabled={busy} onClick={onPublish} className={PRIMARY_BTN}>Publish selected</button>
          )}
          <button type="button" disabled={busy} onClick={onReject} className={REJECT_BTN}>Reject selected…</button>
          <button type="button" disabled={busy} onClick={onClear} className={EDIT_BTN}>Clear</button>
        </div>
      )}
      {busy && <p className="text-xs font-ui text-muted animate-pulse">Working…</p>}
      {failures.length > 0 && (
        <div role="alert" className="text-xs font-ui text-red-300 space-y-0.5">
          <p className="font-semibold">{failures.length} could not be changed (still selected):</p>
          <ul className="space-y-0.5">
            {failures.map((f) => (
              <li key={f.id}><span dir="auto" className="text-warm/80">{f.label}</span> — {f.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
