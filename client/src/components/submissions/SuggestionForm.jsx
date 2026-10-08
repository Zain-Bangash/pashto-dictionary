import { useState } from 'react';
import { createSuggestion, resubmitSuggestion } from '../../services/api';
import ExtraFieldsInputs from '../fields/ExtraFieldsInputs';
import FormsEditor from '../forms/FormsEditor';
import FormsDisplay from '../forms/FormsDisplay';
import { formKindFor, formSlot, formsPayload } from '../../utils/forms';
import { inputCls, labelCls, PRIMARY_BTN, CANCEL_BTN } from './styles';

// Offers inputs only for the word's blank fields (`fillableFields` from the server); the live word is untouched until published
export default function SuggestionForm({ variant, suggestion, onDone, onCancel }) {
  const fillable = variant.fillableFields ?? [];
  const prior = suggestion?.proposed ?? {};
  const extraKeys = fillable.filter((f) => f.startsWith('extra.')).map((f) => f.slice(6));

  const [phonetic, setPhonetic] = useState(prior.phonetic ?? '');
  const [example, setExample]   = useState(prior.example ?? '');
  const [forms, setForms]       = useState(prior.forms ?? []);
  const [extra, setExtra]       = useState(prior.extra ?? {});
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  function payload() {
    const body = {};
    if (fillable.includes('phonetic') && phonetic.trim()) body.phonetic = phonetic;
    if (fillable.includes('example') && example.trim()) body.example = example;
    if (fillable.includes('forms') && forms.length) body.forms = formsPayload(forms);
    const filled = Object.fromEntries(extraKeys.filter((k) => extra[k]?.trim()).map((k) => [k, extra[k]]));
    if (Object.keys(filled).length) body.extra = filled;
    return body;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const body = payload();
    if (!Object.keys(body).length) {
      setError('Fill in at least one missing detail');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (suggestion) await resubmitSuggestion(suggestion._id, body);
      else await createSuggestion(variant._id, body);
      onDone();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to send suggestion');
    } finally {
      setSaving(false);
    }
  }

  const id = (name) => `suggest-${variant._id}-${name}`;

  return (
    <form onSubmit={handleSubmit} aria-label="Suggest missing details" className="mt-4 space-y-3 border-t border-white/[0.08] pt-4">
      <p className="text-[11px] font-ui text-muted/70">
        Your word stays live as it is. These details are added once a moderator reviews them and an admin publishes them.
      </p>
      {fillable.includes('phonetic') && (
        <div>
          <label htmlFor={id('phonetic')} className={labelCls}>Phonetic</label>
          <input id={id('phonetic')} maxLength={100} className={inputCls} value={phonetic} onChange={(e) => setPhonetic(e.target.value)} />
        </div>
      )}
      {fillable.includes('example') && (
        <div>
          <label htmlFor={id('example')} className={labelCls}>Example sentence</label>
          <input id={id('example')} maxLength={500} className={inputCls} value={example} onChange={(e) => setExample(e.target.value)} />
        </div>
      )}
      {extraKeys.length > 0 && (
        <ExtraFieldsInputs
          appliesTo="variant"
          idPrefix={id('extra')}
          onlyKeys={extraKeys}
          values={extra}
          onChange={(key, value) => setExtra((v) => ({ ...v, [key]: value }))}
          inputClassName={inputCls}
          labelClassName={labelCls}
        />
      )}
      {fillable.includes('forms') && (
        <>
          {variant.forms?.length > 0 && <FormsDisplay forms={variant.forms} />}
          <FormsEditor
            kind={formKindFor(variant.concept?.partOfSpeech)}
            forms={forms}
            onChange={setForms}
            takenSlots={(variant.forms ?? []).map(formSlot)}
            idPrefix={id('form')}
            inputClassName={inputCls}
            labelClassName={labelCls}
          />
        </>
      )}
      {error && <p role="alert" className="text-xs font-ui text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={PRIMARY_BTN}>
          {saving ? 'Sending…' : suggestion ? 'Resubmit suggestion' : 'Send suggestion'}
        </button>
        <button type="button" onClick={onCancel} className={CANCEL_BTN}>Cancel</button>
      </div>
    </form>
  );
}
