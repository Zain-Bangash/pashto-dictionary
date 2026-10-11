import { useState } from 'react';
import RecordingControls from '../audio/RecordingControls';
import { headwordMaxSeconds } from '../../utils/audio';
import { labelClass } from './submitStyles';

// Optional headword recording, kept in the browser until the word is submitted
export default function SubmitAudio({ capture, pashto }) {
  const word = pashto.trim();
  const [stamp, setStamp] = useState(null);
  if (capture.clip && stamp?.clip !== capture.clip) setStamp({ clip: capture.clip, word });
  const changed = Boolean(capture.clip) && stamp?.clip === capture.clip && stamp.word !== word;

  return (
    <section aria-labelledby="submit-audio-label" className="space-y-3 bg-white/[0.03] border border-white/[0.07] rounded-[16px] p-4">
      <p id="submit-audio-label" className={labelClass}>Pronunciation (optional)</p>
      {!word && !capture.clip ? (
        <p className="text-xs font-ui text-muted">Type the Pashto word above, then record how it is said in your area.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-[11px] font-ui text-muted">Say</span>
            <span dir="rtl" className="font-pashto text-warm text-2xl">{word}</span>
          </div>
          <p className="text-[11px] font-ui text-muted">
            Up to {headwordMaxSeconds(word)} seconds. Speak clearly; it is reviewed along with your word.
          </p>
          <RecordingControls capture={capture} maxSeconds={headwordMaxSeconds(word)} />
          {changed && (
            <p className="text-xs font-ui text-gold">The word changed since you recorded. Record again if it no longer matches.</p>
          )}
        </>
      )}
    </section>
  );
}
