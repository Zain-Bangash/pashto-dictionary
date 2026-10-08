import FormRow from './FormRow';
import { MAX_FORMS, SLOTS, formSlot } from '../../utils/forms';

const HINT = {
  noun: 'Gendered forms: masculine/feminine × singular/plural × direct/oblique.',
  verb: 'Verb forms: infinitive, past, present and imperative.',
};

// takenSlots: slots already filled elsewhere (e.g. on the live word) that cannot be picked here
export default function FormsEditor({ kind, forms = [], onChange, idPrefix = 'forms', inputClassName, labelClassName, takenSlots = [] }) {
  if (!kind && forms.length === 0) return null;

  const usedSlots = new Set([...takenSlots, ...forms.map(formSlot)]);
  const nextSlot = kind ? SLOTS[kind].find((s) => !usedSlots.has(formSlot(s))) : null;
  const canAdd = nextSlot && forms.length < MAX_FORMS;

  return (
    <fieldset className="space-y-2">
      <legend className={labelClassName}>Grammatical forms (optional)</legend>
      {kind && <p className="text-[11px] font-ui text-muted/70">{HINT[kind]}</p>}
      {forms.length > 0 && (
        <ul className="space-y-2">
          {forms.map((form, i) => (
            <FormRow
              key={formSlot(form)}
              id={`${idPrefix}-${i}`}
              form={form}
              mismatched={form.kind !== kind}
              usedSlots={usedSlots}
              onChange={(next) => onChange(forms.map((f, j) => (j === i ? next : f)))}
              onRemove={() => onChange(forms.filter((_, j) => j !== i))}
              inputClassName={inputClassName}
              labelClassName={labelClassName}
            />
          ))}
        </ul>
      )}
      {canAdd && (
        <button
          type="button"
          onClick={() => onChange([...forms, { ...nextSlot, pashto: '' }])}
          className="text-xs font-ui font-semibold text-gold/80 hover:text-gold transition-colors"
        >
          + Add form
        </button>
      )}
    </fieldset>
  );
}
