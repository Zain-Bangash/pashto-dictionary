import { useState } from 'react';

export default function MergeModal({ sourceItem, targetItem, onConfirm, onCancel }) {
  const [note, setNote] = useState('');
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-charcoal border border-white/[0.12] rounded-[20px] p-6 w-full max-w-md mx-4">
        <h2 className="text-warm font-display text-lg font-semibold mb-2">Confirm Merge</h2>
        <p className="text-sm font-ui text-muted mb-4">
          Move all variants from &ldquo;{sourceItem.englishGloss}&rdquo; into &ldquo;{targetItem.englishGloss}&rdquo; and delete &ldquo;{sourceItem.englishGloss}&rdquo;?
          Variants that would create duplicates will be skipped.
        </p>
        <label htmlFor="merge-note" className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">
          Note
        </label>
        <textarea
          id="merge-note"
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
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
            className="px-4 py-2 bg-mint/10 border border-mint/30 text-mint text-xs font-ui font-semibold rounded-[8px] hover:bg-mint/20 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
