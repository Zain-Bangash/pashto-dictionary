import { useState } from 'react';
import { updateVariant } from '../../services/api';
import LookupSelect from '../LookupSelect';
import ExtraFieldsInputs from '../fields/ExtraFieldsInputs';
import FormsEditor from '../forms/FormsEditor';
import { formKindFor, formsPayload } from '../../utils/forms';
import { inputCls, labelCls, PRIMARY_BTN, CANCEL_BTN } from './styles';
import useAudioRetireConfirm from '../../hooks/useAudioRetireConfirm';

export default function VariantResubmitForm({ variant, onSave, onCancel }) {
  const [fields, setFields] = useState({
    pashto: variant.pashto,
    phonetic: variant.phonetic || '',
    region: variant.region || '',
    definition: variant.definition,
    example: variant.example || '',
    submissionNote: variant.submissionNote || '',
  });
  const [extra, setExtra] = useState(variant.extra || {});
  const [forms, setForms] = useState(variant.forms || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { send, dialog } = useAudioRetireConfirm();

  function set(key) {
    return (e) => setFields((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...fields };
      if (!body.phonetic) delete body.phonetic;
      if (!body.region) delete body.region;
      if (!body.example) delete body.example;
      if (!body.submissionNote) delete body.submissionNote;
      body.extra = extra;
      body.forms = formsPayload(forms);
      const res = await send((confirm) => updateVariant(variant._id, { ...body, ...confirm }));
      if (res) onSave(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-white/[0.08] pt-4">
      <div>
        <label className={labelCls}>Pashto Word</label>
        <input dir="rtl" className={`${inputCls} font-pashto text-lg`} value={fields.pashto} onChange={set('pashto')} required />
      </div>
      <div>
        <label className={labelCls}>Phonetic</label>
        <input className={inputCls} value={fields.phonetic} onChange={set('phonetic')} placeholder="optional" />
      </div>
      <div>
        <label className={labelCls}>Region</label>
        <LookupSelect
          type="region"
          aria-label="Region"
          className={inputCls}
          value={fields.region}
          onChange={set('region')}
          placeholder="— select —"
        />
      </div>
      <div>
        <label className={labelCls}>Definition</label>
        <input className={inputCls} value={fields.definition} onChange={set('definition')} required />
      </div>
      <div>
        <label className={labelCls}>Example</label>
        <input className={inputCls} value={fields.example} onChange={set('example')} placeholder="optional" />
      </div>
      <div>
        <label className={labelCls}>Submission Note</label>
        <input className={inputCls} value={fields.submissionNote} onChange={set('submissionNote')} placeholder="optional" maxLength={500} />
      </div>
      <ExtraFieldsInputs
        appliesTo="variant"
        idPrefix={`resubmit-${variant._id}`}
        values={extra}
        onChange={(key, value) => setExtra((v) => ({ ...v, [key]: value }))}
        inputClassName={inputCls}
        labelClassName={labelCls}
      />
      <FormsEditor
        kind={formKindFor(variant.concept?.partOfSpeech)}
        forms={forms}
        onChange={setForms}
        idPrefix={`resubmit-form-${variant._id}`}
        inputClassName={inputCls}
        labelClassName={labelCls}
      />
      {error && <p className="text-xs font-ui text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className={PRIMARY_BTN}
        >
          {saving ? 'Saving…' : 'Save & Resubmit'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={CANCEL_BTN}
        >
          Cancel
        </button>
      </div>
      {dialog}
    </form>
  );
}
