import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createSuggestion } from '../../services/api';
import ContributeFormsForm from '../forms/ContributeFormsForm';
import { SLOTS, formKindFor } from '../../utils/forms';

const LINK_BTN = 'text-xs font-ui text-gold/70 hover:text-gold transition-colors';

// Anyone signed in can propose the grammatical forms a published word is still missing
export default function SuggestFormsPanel({ variant, partOfSpeech, hasOpen, onSent }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const kind = formKindFor(partOfSpeech);
  const filled = (variant.forms ?? []).filter((f) => f.kind === kind).length;
  if (!kind || filled >= SLOTS[kind].length) return null;

  if (sent) return <p className="text-xs font-ui text-mint/80">Thanks — your forms will appear here once they are reviewed.</p>;
  if (hasOpen) return <p className="text-xs font-ui text-muted/60">Your suggestion for this word is under review.</p>;

  if (!open) {
    return (
      <button type="button" onClick={() => (user ? setOpen(true) : navigate('/login'))} className={LINK_BTN}>
        + Suggest forms
      </button>
    );
  }

  return (
    <ContributeFormsForm
      kind={kind}
      liveForms={variant.forms ?? []}
      idPrefix={`contribute-${variant._id}`}
      submitLabel="Send suggestion"
      onSubmit={async (forms) => {
        await createSuggestion(variant._id, { forms });
        setSent(true);
        onSent?.(variant._id);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}
