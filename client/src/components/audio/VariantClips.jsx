import useLookups from '../../hooks/useLookups';
import { audioSlotLabel, speakerCredit } from '../../utils/audio';
import AudioPlayButton from './AudioPlayButton';

// Published recordings of a word other than the headword (which plays beside the word itself)
export default function VariantClips({ variant }) {
  const { labelFor } = useLookups();
  const others = (variant.audioSlots ?? []).filter((s) => s.slot !== 'headword' && variant.audio?.[s.slot]);
  if (!others.length) return null;

  return (
    <ul aria-label="Pronunciation recordings" className="divide-y divide-white/[0.06] border border-white/[0.06] rounded-[12px]">
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
  );
}
