import { useState } from 'react';
import { uploadAudio } from '../../services/api';
import useClipCapture from '../../hooks/useClipCapture';
import { audioSlotLabel } from '../../utils/audio';
import { APPROVE_BTN, EDIT_BTN } from '../moderation/queueButtons';
import RecordingControls from './RecordingControls';

// slots: [{ slot, text, maxSeconds, open }] from the word's audioSlots; open ones are under review
export default function AudioRecorder({ variantId, slots, initialSlot, onUploaded, onClose }) {
  const available = slots.filter((s) => !s.open);
  const [slot, setSlot] = useState(available.some((s) => s.slot === initialSlot) ? initialSlot : available[0]?.slot);
  const target = slots.find((s) => s.slot === slot);
  const capture = useClipCapture(target?.maxSeconds ?? 10);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  if (!available.length) {
    return <p className="text-xs font-ui text-muted">Every part of this word already has a recording under review.</p>;
  }

  const chooseSlot = (e) => { capture.discard(); setSlot(e.target.value); };

  const submit = async () => {
    setUploading(true);
    capture.setError(null);
    try {
      await uploadAudio(variantId, slot, capture.clip);
      setDone(true);
      onUploaded?.(slot);
    } catch (err) {
      capture.setError(err?.response?.data?.error?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <div role="status" className="space-y-2">
        <p className="text-sm font-ui text-mint">Thank you! Your recording is waiting for review.</p>
        <button type="button" onClick={onClose} className={EDIT_BTN}>Close</button>
      </div>
    );
  }

  return (
    <section aria-label="Record a pronunciation" className="space-y-3 bg-white/[0.03] border border-white/[0.08] rounded-[14px] p-4">
      <label className="block">
        <span className="block text-[11px] font-ui text-muted uppercase tracking-wider mb-1">What are you recording?</span>
        <select
          value={slot}
          onChange={chooseSlot}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-terracotta/60"
        >
          {slots.map((s) => (
            <option key={s.slot} value={s.slot} disabled={s.open}>
              {audioSlotLabel(s.slot)}{s.open ? ' (under review)' : ''}
            </option>
          ))}
        </select>
      </label>

      {target?.text ? (
        <p dir="rtl" className="font-pashto text-warm text-2xl leading-[1.8]">{target.text}</p>
      ) : (
        <p className="text-xs font-ui text-muted">This form has no text yet. Say the word in this form.</p>
      )}
      <p className="text-[11px] font-ui text-muted">Up to {target?.maxSeconds} seconds. Speak clearly, the way it is said in your area.</p>

      <RecordingControls
        capture={capture}
        maxSeconds={target?.maxSeconds}
        actions={(
          <button type="button" onClick={submit} disabled={uploading} className={APPROVE_BTN}>
            {uploading ? 'Uploading…' : 'Submit for review'}
          </button>
        )}
      />

      <button type="button" onClick={onClose} className="text-[11px] font-ui text-muted hover:text-warm">Cancel</button>
    </section>
  );
}
