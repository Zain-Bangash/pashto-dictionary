import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useLookups from '../../hooks/useLookups';
import AudioRecorder from '../audio/AudioRecorder';
import VariantHeader from './VariantHeader';
import RegionTabs from './RegionTabs';
import VariantBody from './VariantBody';
import VariantActions from './VariantActions';
import SuggestFormsPanel from './SuggestFormsPanel';
import { speakerCredit } from '../../utils/audio';
import { hasEmptyFormSlots } from '../../utils/forms';

// One Pashto word with a region tab strip; reading on the left, contributing on the right, one panel open at a time
export default function VariantCard({ group, conceptId, partOfSpeech, openVariantIds, onSuggestionSent, className = '' }) {
  const { user } = useAuth();
  const { labelFor } = useLookups();
  const navigate = useNavigate();
  const [activeIdx, setActiveIdx] = useState(0);
  const [panel, setPanel] = useState(null);
  const [sentIds, setSentIds] = useState([]);
  const [openSlotsById, setOpenSlotsById] = useState({});

  const pashtoWord = group[0].pashto;
  const selected = group[activeIdx] ?? group[0];
  const id = String(selected._id);
  const openSlots = openSlotsById[id] ?? selected.audioOpen ?? [];
  const slots = (selected.audioSlots ?? []).map((s) => ({ ...s, open: openSlots.includes(s.slot) }));
  const addedBy = speakerCredit(selected.submittedBy, labelFor);

  let formsState = null;
  if (sentIds.includes(id)) formsState = 'sent';
  else if (openVariantIds?.has(id)) formsState = 'open';
  else if (hasEmptyFormSlots(selected.forms, partOfSpeech)) formsState = 'available';

  const requireUser = (fn) => () => (user ? fn() : navigate('/login'));
  const toggle = (name) => requireUser(() => setPanel((p) => (p === name ? null : name)));

  const selectRegion = (idx) => {
    setActiveIdx(idx);
    setPanel(null);
  };

  const alsoSayThis = requireUser(() => {
    const params = new URLSearchParams({
      conceptId,
      pashto: pashtoWord,
      ...(selected.phonetic && { phonetic: selected.phonetic }),
    });
    navigate(`/submit?${params.toString()}`);
  });

  const formsSent = (variantId) => {
    setSentIds((ids) => [...ids, String(variantId)]);
    setPanel(null);
    onSuggestionSent?.(variantId);
  };

  return (
    <li className={`bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-5 sm:p-6 ${className}`}>
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="flex-1 min-w-0 space-y-3">
          <VariantHeader pashto={pashtoWord} variant={selected} />
          <RegionTabs group={group} activeIdx={activeIdx} onSelect={selectRegion} />
          <VariantBody variant={selected} />
        </div>
        <VariantActions
          panel={panel}
          canRecord={slots.length > 0}
          formsState={formsState}
          onRecord={toggle('record')}
          onAlsoSay={alsoSayThis}
          onSuggestForms={toggle('forms')}
        />
      </div>

      {panel && (
        <div className="mt-5 pt-5 border-t border-white/[0.06]">
          {panel === 'record' && (
            <AudioRecorder
              key={id}
              variantId={selected._id}
              slots={slots}
              onUploaded={(slot) => setOpenSlotsById((m) => ({ ...m, [id]: [...openSlots, slot] }))}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === 'forms' && (
            <SuggestFormsPanel key={id} variant={selected} partOfSpeech={partOfSpeech} onSent={formsSent} onCancel={() => setPanel(null)} />
          )}
        </div>
      )}

      {addedBy && <p className="mt-4 text-[11px] font-ui text-muted/50">Added by {addedBy}</p>}
    </li>
  );
}
