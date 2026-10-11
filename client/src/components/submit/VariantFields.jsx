import LookupSelect from '../LookupSelect';
import ExtraFieldsInputs from '../fields/ExtraFieldsInputs';
import FormsEditor from '../forms/FormsEditor';
import { inputClass, selectClass, labelClass, errorClass } from './submitStyles';

function TextField({ id, label, value, onChange, error, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} placeholder={placeholder} />
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}

// Everything about the regional word after the headword and its recording
export default function VariantFields({ form }) {
  const { values, setField, errors, formKind, activeForms, setActiveForms, variantExtra, setVariantExtra } = form;
  const bind = (name) => ({ value: values[name], onChange: (v) => setField(name, v), error: errors[name] });

  return (
    <>
      <TextField id="phonetic" label="Phonetic (optional)" {...bind('phonetic')} />

      <div>
        <label htmlFor="region" className={labelClass}>Region</label>
        <LookupSelect
          type="region"
          id="region"
          value={values.region}
          onChange={(e) => setField('region', e.target.value)}
          placeholder="Select…"
          className={selectClass}
          optionClassName="bg-charcoal"
        />
        {errors.region && <p className={errorClass}>{errors.region}</p>}
      </div>

      <TextField id="definition" label="Definition" placeholder="Meaning in English…" {...bind('definition')} />
      <TextField id="example" label="Example sentence (optional)" {...bind('example')} />

      <div>
        <FormsEditor
          kind={formKind}
          forms={activeForms}
          onChange={setActiveForms}
          idPrefix="submit-form"
          inputClassName={inputClass}
          labelClassName={labelClass}
        />
        {errors.forms && <p className={errorClass}>{errors.forms}</p>}
      </div>

      <ExtraFieldsInputs
        appliesTo="variant"
        values={variantExtra}
        onChange={(key, value) => setVariantExtra((v) => ({ ...v, [key]: value }))}
        errors={errors.variantExtra}
        inputClassName={inputClass}
        labelClassName={labelClass}
        optionClassName="bg-charcoal"
      />

      <div>
        <label htmlFor="submissionNote" className={labelClass}>Note to moderators (optional)</label>
        <textarea
          id="submissionNote"
          value={values.submissionNote}
          onChange={(e) => setField('submissionNote', e.target.value)}
          className={`${inputClass} resize-none`}
          rows={3}
          maxLength={500}
          placeholder="Add a reference, source, or link that supports this word…"
        />
        <p className="text-muted font-ui text-xs mt-1">{values.submissionNote.length}/500</p>
      </div>
    </>
  );
}
