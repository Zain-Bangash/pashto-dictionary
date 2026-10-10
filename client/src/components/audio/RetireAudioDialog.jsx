import { audioSlotLabel } from '../../utils/audio';

export default function RetireAudioDialog({ retiring, onConfirm, onCancel }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="retire-audio-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-charcoal border border-white/[0.12] rounded-[20px] p-6 w-full max-w-md mx-4">
        <h2 id="retire-audio-title" className="text-warm font-display text-lg font-semibold mb-2">This removes recordings</h2>
        <p className="text-sm font-ui text-muted mb-3">
          The text these recordings speak will change or no longer exist, so they will be removed and their audio deleted.
        </p>
        <ul className="mb-4 space-y-1">
          {retiring.map((clip) => (
            <li key={clip._id} className="text-sm font-ui text-amber-300/90">
              {audioSlotLabel(clip.slot)}
              {clip.speaker && <span className="text-muted"> — recorded by {clip.speaker}</span>}
              {clip.status !== 'published' && <span className="text-muted/60"> (under review)</span>}
            </li>
          ))}
        </ul>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-400/10 border border-red-400/30 text-red-400 text-xs font-ui font-semibold rounded-[8px] hover:bg-red-400/20 transition-colors"
          >
            Remove recordings and save
          </button>
        </div>
      </div>
    </div>
  );
}
