import { createSuggestion } from '../../services/api';
import ContributeFormsForm from '../forms/ContributeFormsForm';
import { formKindFor } from '../../utils/forms';

// The editor for proposing the grammatical forms a published word is still missing
export default function SuggestFormsPanel({ variant, partOfSpeech, onSent, onCancel }) {
  return (
    <ContributeFormsForm
      kind={formKindFor(partOfSpeech)}
      liveForms={variant.forms ?? []}
      idPrefix={`contribute-${variant._id}`}
      submitLabel="Send suggestion"
      onSubmit={async (forms) => {
        await createSuggestion(variant._id, { forms });
        onSent?.(variant._id);
      }}
      onCancel={onCancel}
    />
  );
}
