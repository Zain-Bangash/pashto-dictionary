import { useState } from 'react';
import RecordingControls from '../audio/RecordingControls';
import { slotMaxSeconds } from '../../utils/audio';
import { labelClass } from './submitStyles';

const COPY = {
  headword: {
    title: 'Pronunciation (optional)',
    empty: 'Type the Pashto word above, then record how it is said in your area.',
    changed: 'The word changed since you recorded. Record again if it no longer matches.',
  },
  example: {
    title: 'Example recording (optional)',
    empty: 'Type the example sentence above, then record how it is said in your area.',
    changed: 'The example changed since you recorded. Record again if it no longer matches.',
  },
};

// Optional recording of the word or its example, kept in the browser until the word is submitted
export default function SubmitAudio({ capture, text, slot = 'headword' }) {
  const copy = COPY[slot];
  const said = text.trim();
  const maxSeconds = slotMaxSeconds(slot, said);
  const [stamp, setStamp] = useState(null);
  if (capture.clip && stamp?.clip !== capture.clip) setStamp({ clip: capture.clip, said });
  const changed = Boolean(capture.clip) && stamp?.clip === capture.clip && stamp.said !== said;
  const labelId = `submit-audio-${slot}`;

  return (
    <section aria-labelledby={labelId} className="space-y-3 bg-white/[0.03] border border-white/[0.07] rounded-[16px] p-4">
      <p id={labelId} className={labelClass}>{copy.title}</p>
      {!said && !capture.clip ? (
        <p className="text-xs font-ui text-muted">{copy.empty}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-[11px] font-ui text-muted">Say</span>
            <span dir="rtl" className="font-pashto text-warm text-2xl">{said}</span>
          </div>
          <p className="text-[11px] font-ui text-muted">
            Up to {maxSeconds} seconds. Speak clearly; it is reviewed along with your word.
          </p>
          <RecordingControls capture={capture} maxSeconds={maxSeconds} />
          {changed && <p className="text-xs font-ui text-gold">{copy.changed}</p>}
        </>
      )}
    </section>
  );
}
