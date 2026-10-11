import LookupSelect from '../LookupSelect';
import DomainPicker from '../DomainPicker';
import ExtraFieldsInputs from '../fields/ExtraFieldsInputs';
import { inputClass, selectClass, labelClass, errorClass } from './submitStyles';

// Part of speech, domains and concept extras, shown only when creating a concept
export default function NewConceptFields({ form }) {
  const { newPos, setNewPos, domains, setDomains, conceptExtra, setConceptExtra, errors } = form;
  return (
    <>
      <div>
        <label htmlFor="partOfSpeech" className={labelClass}>Part of Speech</label>
        <LookupSelect
          type="partOfSpeech"
          id="partOfSpeech"
          value={newPos}
          onChange={(e) => setNewPos(e.target.value)}
          placeholder="Select…"
          className={selectClass}
          optionClassName="bg-charcoal"
        />
        {errors.partOfSpeech && <p className={errorClass}>{errors.partOfSpeech}</p>}
      </div>

      <DomainPicker
        value={domains}
        onChange={setDomains}
        label="Domains (optional)"
        hint="What is this word about? Pick any that fit."
        labelClassName={labelClass}
      />

      <ExtraFieldsInputs
        appliesTo="concept"
        values={conceptExtra}
        onChange={(key, value) => setConceptExtra((v) => ({ ...v, [key]: value }))}
        errors={errors.conceptExtra}
        inputClassName={inputClass}
        labelClassName={labelClass}
        optionClassName="bg-charcoal"
      />
    </>
  );
}
