import { useState, useMemo, useEffect } from 'react';
import { uploadAudio } from '../../services/api';
import useRecorder from '../../hooks/useRecorder';
import { audioSlotLabel, canRecord, UPLOAD_ACCEPT, MAX_UPLOAD_BYTES } from '../../utils/audio';
import { APPROVE_BTN, EDIT_BTN, REJECT_BTN } from '../moderation/queueButtons';

const seconds = (ms) => (ms / 1000).toFixed(1);

// slots: [{ slot, text, maxSeconds, open }] from the word's audioSlots; open ones are under review
export default function AudioRecorder({ variantId, slots, initialSlot, onUploaded, onClose }) {
  const available = slots.filter((s) => !s.open);
  const [slot, setSlot] = useState(initialSlot ?? available[0]?.slot);
  const target = slots.find((s) => s.slot === slot);
  const recorder = useRecorder(target?.maxSeconds ?? 10);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const clip = file ?? recorder.blob;
  const previewUrl = useMemo(() => (clip && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(clip) : null), [clip]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  if (!available.length) {
    return <p className="text-xs font-ui text-muted">Every part of this word already has a recording under review.</p>;
  }

  const discard = () => { setFile(null); setError(null); recorder.reset(); };

  const chooseSlot = (e) => { discard(); setSlot(e.target.value); };

  const chooseFile = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    recorder.reset();
    if (picked.size > MAX_UPLOAD_BYTES) {
      setError('The file must be 1 MB or smaller.');
      return;
    }
    setError(null);
    setFile(picked);
  };

  const submit = async () => {
    setUploading(true);
    setError(null);
    try {
      await uploadAudio(variantId, slot, clip);
      setDone(true);
      onUploaded?.(slot);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Upload failed. Please try again.');
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
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
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

      <div className="flex flex-wrap items-center gap-2">
        {recorder.status === 'recording' ? (
          <>
            <button type="button" onClick={recorder.stop} className={REJECT_BTN}>■ Stop</button>
            <span aria-live="polite" className="text-xs font-ui text-red-400 tabular-nums">
              Recording {seconds(recorder.elapsed)} / {target?.maxSeconds}s
            </span>
          </>
        ) : !clip && canRecord() ? (
          <button type="button" onClick={recorder.start} disabled={recorder.status === 'requesting'} className={REJECT_BTN}>
            {recorder.status === 'requesting' ? 'Allow the microphone…' : '● Record'}
          </button>
        ) : null}

        {clip && (
          <>
            {previewUrl && <audio controls src={previewUrl} aria-label="Preview your recording" className="h-8 max-w-full" />}
            <button type="button" onClick={discard} className={EDIT_BTN}>Discard</button>
            <button type="button" onClick={submit} disabled={uploading} className={APPROVE_BTN}>
              {uploading ? 'Uploading…' : 'Submit for review'}
            </button>
          </>
        )}
      </div>

      {!clip && recorder.status !== 'recording' && (
        <label className="block text-[11px] font-ui text-muted">
          <span>Or upload a recording (WebM, M4A, MP3 or Ogg, up to 1 MB): </span>
          <input type="file" accept={UPLOAD_ACCEPT} onChange={chooseFile} aria-label="Upload a recording" className="mt-1 block text-xs text-muted file:mr-2 file:rounded-[8px] file:border-0 file:bg-white/[0.08] file:px-2 file:py-1 file:text-warm" />
        </label>
      )}

      {(error || recorder.error) && <p role="alert" className="text-xs font-ui text-red-400">{error || recorder.error}</p>}

      <button type="button" onClick={onClose} className="text-[11px] font-ui text-muted hover:text-warm">Cancel</button>
    </section>
  );
}
