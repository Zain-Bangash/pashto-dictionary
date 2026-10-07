import { useState } from 'react';

export default function RejectModal({ onConfirm, onCancel }) {
  const [note, setNote] = useState('');
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-charcoal border border-white/[0.12] rounded-[20px] p-6 w-full max-w-md mx-4">
        <h2 className="text-warm font-display text-lg font-semibold mb-4">Rejection Reason</h2>
        <label htmlFor="reject-reason" className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">
          Reason for rejection
        </label>
        <textarea
          id="reject-reason"
          placeholder="Reason for rejection"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-2 text-warm text-sm font-ui outline-none focus:border-mint/50 resize-none"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note)}
            disabled={!note.trim()}
            className="px-4 py-2 bg-red-400/10 border border-red-400/30 text-red-400 text-xs font-ui font-semibold rounded-[8px] hover:bg-red-400/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
