import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useLookups from '../../hooks/useLookups';
import { audioSlotLabel, speakerCredit } from '../../utils/audio';
import AudioPlayButton from './AudioPlayButton';
import AudioRecorder from './AudioRecorder';

// Recordings of one regional variant other than the headword (shown beside the word), plus the record button
export default function VariantAudio({ variant }) {
  const { user } = useAuth();
  const { labelFor } = useLookups();
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [openSlots, setOpenSlots] = useState(variant.audioOpen ?? []);

  const slots = (variant.audioSlots ?? []).map((s) => ({ ...s, open: openSlots.includes(s.slot) }));
  if (!slots.length) return null;
  const others = slots.filter((s) => s.slot !== 'headword' && variant.audio?.[s.slot]);

  const startRecording = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setRecording(true);
  };

  return (
    <section aria-label="Pronunciation recordings" className="space-y-2">
      {others.length > 0 && (
        <ul className="divide-y divide-white/[0.06] border border-white/[0.06] rounded-[12px]">
          {others.map((s) => {
            const clip = variant.audio[s.slot];
            const credit = speakerCredit(clip.submittedBy, labelFor);
            return (
              <li key={s.slot} className="px-3 py-2 flex items-center gap-3">
                <AudioPlayButton clip={clip} label={`Play ${audioSlotLabel(s.slot).toLowerCase()}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-ui text-muted uppercase tracking-wider">{audioSlotLabel(s.slot)}</p>
                  {s.text && <p dir="rtl" className="font-pashto text-warm/90 text-base truncate">{s.text}</p>}
                  {credit && <p className="text-[10px] font-ui text-muted/50">Recorded by {credit}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {recording ? (
        <AudioRecorder
          variantId={variant._id}
          slots={slots}
          onUploaded={(slot) => setOpenSlots((o) => [...o, slot])}
          onClose={() => setRecording(false)}
        />
      ) : (
        <button type="button" onClick={startRecording} className="text-xs font-ui text-mint/70 hover:text-mint transition-colors">
          🎙 Record a pronunciation
        </button>
      )}
    </section>
  );
}
