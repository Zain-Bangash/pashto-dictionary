import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useLookups from '../../hooks/useLookups';
import ExtraFieldsDisplay from '../fields/ExtraFieldsDisplay';
import FormsDisplay from '../forms/FormsDisplay';
import AudioPlayButton from '../audio/AudioPlayButton';
import VariantAudio from '../audio/VariantAudio';
import SuggestFormsPanel from './SuggestFormsPanel';
import { speakerCredit } from '../../utils/audio';

const TAB = 'text-xs font-ui px-3 py-1 rounded-full transition-all border';
const TAB_ON = 'bg-mint/[0.12] border-mint/35 text-mint';
const TAB_OFF = 'bg-white/[0.05] border-white/[0.08] text-[#888]';

// One Pashto word with a region tab strip; the same word from several regions shares a card
export default function VariantCard({ group, conceptId, partOfSpeech, openVariantIds, onSuggestionSent }) {
  const { user } = useAuth();
  const { labelFor } = useLookups();
  const navigate = useNavigate();
  const [activeIdx, setActiveIdx] = useState(0);

  const pashtoWord = group[0].pashto;
  const selected = group[activeIdx] ?? group[0];
  const headwordClip = selected.audio?.headword;
  const headwordCredit = speakerCredit(headwordClip?.submittedBy, labelFor);
  const addedBy = speakerCredit(selected.submittedBy, labelFor);

  const alsoSayThis = () => {
    if (!user) { navigate('/login'); return; }
    const params = new URLSearchParams({
      conceptId,
      pashto: pashtoWord,
      ...(selected.phonetic && { phonetic: selected.phonetic }),
    });
    navigate(`/submit?${params.toString()}`);
  };

  return (
    <li className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-6 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div dir="rtl" className="font-pashto text-warm font-bold text-[56px] leading-[1.7]">{pashtoWord}</div>
        <AudioPlayButton key={selected._id} clip={headwordClip} label={`Play ${labelFor('region', selected.region)} pronunciation`} />
      </div>
      {headwordCredit && <p className="text-[10px] font-ui text-muted/50 -mt-2">Recorded by {headwordCredit}</p>}

      <div className="flex gap-2 flex-wrap">
        {group.map((v, idx) => (
          <button
            key={v._id}
            type="button"
            onClick={() => setActiveIdx(idx)}
            className={`${TAB} ${activeIdx === idx ? TAB_ON : TAB_OFF}`}
          >
            {labelFor('region', v.region)}
          </button>
        ))}
      </div>

      {selected.phonetic && <p className="font-display text-lg italic text-gold">{selected.phonetic}</p>}
      <p className="font-ui text-warm/80 text-sm leading-relaxed">{selected.definition}</p>
      {selected.example && <p className="font-ui text-muted text-sm italic">{selected.example}</p>}
      <ExtraFieldsDisplay appliesTo="variant" values={selected.extra} />
      <FormsDisplay key={selected._id} forms={selected.forms} ownerSub={selected.submittedBy?.cognitoSub} />
      <SuggestFormsPanel
        key={`suggest-${selected._id}`}
        variant={selected}
        partOfSpeech={partOfSpeech}
        hasOpen={openVariantIds?.has(String(selected._id))}
        onSent={onSuggestionSent}
      />
      <VariantAudio key={`audio-${selected._id}`} variant={selected} />

      {addedBy && <p className="text-[11px] font-ui text-muted/40">Added by {addedBy}</p>}

      <button type="button" onClick={alsoSayThis} className="mt-1 text-xs font-ui text-gold/70 hover:text-gold transition-colors">
        + I also say this in my region
      </button>
    </li>
  );
}
