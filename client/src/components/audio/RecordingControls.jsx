import { canRecord, UPLOAD_ACCEPT } from '../../utils/audio';
import { EDIT_BTN, REJECT_BTN } from '../moderation/queueButtons';

const RECORD_BTN = 'listen-btn inline-flex items-center gap-1.5 border border-terracotta/35 rounded-full text-terracotta hover:bg-terracotta/10 px-3 py-1.5 font-ui text-xs font-semibold transition-colors disabled:opacity-50';

const seconds = (ms) => (ms / 1000).toFixed(1);

// Record / stop / preview / discard / upload a file, for a capture from useClipCapture; actions show once there is a clip
export default function RecordingControls({ capture, maxSeconds, actions }) {
  const { recorder, clip, previewUrl, error, discard, chooseFile } = capture;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {recorder.status === 'recording' ? (
          <>
            <button type="button" onClick={recorder.stop} className={REJECT_BTN}>■ Stop</button>
            <span aria-live="polite" className="text-xs font-ui text-red-400 tabular-nums">
              Recording {seconds(recorder.elapsed)} / {maxSeconds}s
            </span>
          </>
        ) : !clip && canRecord() ? (
          <button type="button" onClick={recorder.start} disabled={recorder.status === 'requesting'} className={RECORD_BTN}>
            {recorder.status === 'requesting' ? 'Allow the microphone…' : '● Record'}
          </button>
        ) : null}

        {clip && (
          <>
            {previewUrl && <audio controls src={previewUrl} aria-label="Preview your recording" className="h-8 max-w-full" />}
            <button type="button" onClick={discard} className={EDIT_BTN}>Discard</button>
            {actions}
          </>
        )}
      </div>

      {!clip && recorder.status !== 'recording' && (
        <label className="block text-[11px] font-ui text-muted">
          <span>Or upload a recording (WebM, M4A, MP3 or Ogg, up to 1 MB): </span>
          <input type="file" accept={UPLOAD_ACCEPT} onChange={chooseFile} aria-label="Upload a recording" className="mt-1 block text-xs text-muted file:mr-2 file:rounded-[8px] file:border-0 file:bg-white/[0.08] file:px-2 file:py-1 file:text-warm" />
        </label>
      )}

      {error && <p role="alert" className="text-xs font-ui text-red-400">{error}</p>}
    </>
  );
}
