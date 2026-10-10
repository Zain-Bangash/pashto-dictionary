import { useState } from 'react';

// The note is optional: only admins can read the Moderation Log, so the person affected never sees it
export default function RoleChangeDialog({ target, nextRole, saving, error, onConfirm, onCancel }) {
  const [note, setNote] = useState('');
  const promoting = nextRole === 'moderator';

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="role-change-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-charcoal border border-white/[0.12] rounded-[20px] p-6 w-full max-w-md mx-4">
        <h2 id="role-change-title" className="text-warm font-display text-lg font-semibold mb-2">
          {promoting ? 'Make moderator' : 'Remove moderator'}
        </h2>
        <p className="text-sm font-ui text-muted mb-4">
          {promoting
            ? `${target.username} will be able to approve and reject submissions in the moderation queue.`
            : `${target.username} will lose access to the dashboard and become a regular user.`}
        </p>
        <label htmlFor="role-change-note" className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">
          Note (optional)
        </label>
        <textarea
          id="role-change-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-2 text-warm text-sm font-ui outline-none focus:border-mint/50 resize-none"
        />
        {error && <p role="alert" className="mt-2 text-xs font-ui text-red-400">{error}</p>}
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note.trim())}
            disabled={saving}
            className="px-4 py-2 bg-mint/10 border border-mint/30 text-mint text-xs font-ui font-semibold rounded-[8px] hover:bg-mint/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
