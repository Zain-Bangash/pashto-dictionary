import RecordingControls from '../audio/RecordingControls';
import { EDIT_BTN } from '../moderation/queueButtons';
import { PRIMARY_CTA } from './submitStyles';
import { audioSlotLabel } from '../../utils/audio';

// Shown when the word was saved but a recording failed to upload. failed: [{ slot, capture, maxSeconds }]
export default function AudioRetryPanel({ failed, error, loading, onRetry, onSkip }) {
  const single = failed.length === 1;
  return (
    <div className="space-y-4">
      <div role="status" className="rounded-[12px] border border-gold/30 bg-gold/[0.08] px-3 py-2 text-sm font-ui text-gold">
        Your word was submitted and is waiting for review.
      </div>
      {error && <p className="text-xs font-ui text-red-400">{error}</p>}
      {failed.map(({ slot, capture, maxSeconds }) => (
        <div key={slot} className="space-y-3 bg-white/[0.03] border border-white/[0.07] rounded-[16px] p-4">
          <p className="text-sm font-ui text-warm">
            {single && slot === 'headword' ? "The recording couldn't be uploaded." : `The ${audioSlotLabel(slot).toLowerCase()} recording couldn't be uploaded.`}
          </p>
          <RecordingControls capture={capture} maxSeconds={maxSeconds} />
        </div>
      ))}
      <button type="button" onClick={onRetry} disabled={loading || !failed.some((f) => f.capture.clip)} className={PRIMARY_CTA}>
        {loading ? 'Uploading…' : 'Try again'}
      </button>
      <button type="button" onClick={onSkip} className={`w-full ${EDIT_BTN} py-2.5`}>Continue without it</button>
    </div>
  );
}
