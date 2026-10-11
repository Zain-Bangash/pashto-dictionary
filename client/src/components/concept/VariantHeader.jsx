import useLookups from '../../hooks/useLookups';
import AudioPlayButton from '../audio/AudioPlayButton';
import { speakerCredit } from '../../utils/audio';

// The written word with the selected region's headword recording beside it
export default function VariantHeader({ pashto, variant }) {
  const { labelFor } = useLookups();
  const clip = variant.audio?.headword;
  const credit = speakerCredit(clip?.submittedBy, labelFor);

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <div dir="rtl" className="font-pashto text-warm font-bold text-5xl sm:text-[56px]">{pashto}</div>
        <AudioPlayButton key={variant._id} clip={clip} label={`Play ${labelFor('region', variant.region)} pronunciation`} />
      </div>
      {credit && <p className="text-[10px] font-ui text-muted/60">Recorded by {credit}</p>}
    </div>
  );
}
