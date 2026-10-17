import useLookups from '../../hooks/useLookups';
import AudioPlayButton from '../audio/AudioPlayButton';
import { speakerCredit } from '../../utils/audio';

// The example sentence with its recording beside it, credited like the word's
export default function VariantExample({ variant }) {
  const { labelFor } = useLookups();
  if (!variant.example) return null;
  const clip = variant.audio?.example;
  const credit = speakerCredit(clip?.submittedBy, labelFor);

  return (
    <div>
      <div className="flex items-center gap-3">
        <AudioPlayButton key={variant._id} clip={clip} label={`Play ${labelFor('region', variant.region)} example`} className="shrink-0" />
        <p dir="rtl" className="flex-1 min-w-0 font-pashto text-warm/60 text-lg border-r-2 border-gold/30 pr-3">{variant.example}</p>
      </div>
      {credit && <p className="text-[10px] font-ui text-muted/60 mt-1">Example recorded by {credit}</p>}
    </div>
  );
}
