import { useState } from 'react';
import { transitionAudio } from '../../services/api';
import useLookups from '../../hooks/useLookups';
import RejectModal from '../moderation/RejectModal';
import AudioPlayButton from './AudioPlayButton';
import { audioSlotLabel, speakerCredit } from '../../utils/audio';
import { REJECT_BTN } from '../moderation/queueButtons';

// Admin view of a published word's live recordings, each removable with a note
export default function PublishedClips({ variant }) {
  const { labelFor } = useLookups();
  const [clips, setClips] = useState(() => Object.entries(variant.audio ?? {}));
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState(null);

  if (!clips.length) return null;

  const confirmRemove = async (note) => {
    const id = removing;
    setRemoving(null);
    setError(null);
    try {
      await transitionAudio(id, { status: 'rejected', moderatorNote: note });
      setClips((cs) => cs.filter(([, clip]) => clip._id !== id));
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not remove the recording');
    }
  };

  return (
    <section aria-label="Recordings" className="mt-2 space-y-1">
      <p className="text-[10px] font-ui font-semibold text-muted uppercase tracking-wider">Recordings</p>
      <ul className="space-y-1">
        {clips.map(([slot, clip]) => (
          <li key={clip._id} className="flex items-center gap-2 flex-wrap">
            <AudioPlayButton clip={clip} label={`Play ${audioSlotLabel(slot).toLowerCase()} recording`} />
            <span className="text-xs font-ui text-muted">
              {audioSlotLabel(slot)} · {speakerCredit(clip.submittedBy, labelFor) ?? 'unknown'}
            </span>
            <button onClick={() => setRemoving(clip._id)} aria-label={`Remove ${audioSlotLabel(slot)} recording`} className={REJECT_BTN}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-xs font-ui text-red-400">{error}</p>}
      {removing && <RejectModal onConfirm={confirmRemove} onCancel={() => setRemoving(null)} />}
    </section>
  );
}
