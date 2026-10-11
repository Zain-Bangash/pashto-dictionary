import { useState } from 'react';
import { createSuggestion, resubmitSuggestion } from '../../services/api';
import ExtraFieldsInputs from '../fields/ExtraFieldsInputs';
import FormsEditor from '../forms/FormsEditor';
import FormsDisplay from '../forms/FormsDisplay';
import { formKindFor, formSlot, formsPayload } from '../../utils/forms';
import { inputCls, labelCls, PRIMARY_BTN, CANCEL_BTN } from './styles';

const TEXT_FIELDS = [
  { key: 'pashto', label: 'Pashto', max: 100, rtl: true },
  { key: 'phonetic', label: 'Phonetic', max: 100 },
  { key: 'definition', label: 'Definition', max: 500 },
  { key: 'example', label: 'Example sentence', max: 500 },
];

// The word's submitter proposes changes: the four text fields start from the live word, and only the ones they change are sent.
// Custom fields and forms can only fill blanks (`fillableFields` from the server). The live word is untouched until published.
export default function SuggestionForm({ variant, suggestion, onDone, onCancel }) {
  const fillable = variant.fillableFields ?? [];
  const prior = suggestion?.proposed ?? {};
  const extraKeys = fillable.filter((f) => f.startsWith('extra.')).map((f) => f.slice(6));

  const [text, setText]   = useState(() => Object.fromEntries(TEXT_FIELDS.map(({ key }) => [key, prior[key] ?? variant[key] ?? ''])));
  const [forms, setForms]       = useState(prior.forms ?? []);
  const [extra, setExtra]       = useState(prior.extra ?? {});
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  function payload() {
    const body = {};
    for (const { key } of TEXT_FIELDS) {
      if (text[key].trim() && text[key].trim() !== (variant[key] ?? '')) body[key] = text[key];
    }
    if (fillable.includes('forms') && forms.length) body.forms = formsPayload(forms);
    const filled = Object.fromEntries(extraKeys.filter((k) => extra[k]?.trim()).map((k) => [k, extra[k]]));
    if (Object.keys(filled).length) body.extra = filled;
    return body;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const body = payload();
    if (!Object.keys(body).length) {
      setError('Change at least one detail');
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
    <form onSubmit={handleSubmit} aria-label="Suggest changes" className="mt-4 space-y-3 border-t border-white/[0.08] pt-4">
      <p className="text-[11px] font-ui text-muted/70">
        Your word stays live as it is. Your changes apply once a moderator reviews them and an admin publishes them.
      </p>
      {TEXT_FIELDS.map(({ key, label, max, rtl }) => (
        <div key={key}>
          <label htmlFor={id(key)} className={labelCls}>{label}</label>
          <input
            id={id(key)}
            dir={rtl ? 'rtl' : undefined}
            maxLength={max}
            className={`${inputCls} ${rtl ? 'font-pashto' : ''}`}
            value={text[key]}
            onChange={(e) => setText((t) => ({ ...t, [key]: e.target.value }))}
          />
          {variant[key] && text[key].trim() !== variant[key] && (
            <p className="mt-1 text-[11px] font-ui text-muted/60">Current: <span dir={rtl ? 'rtl' : 'auto'}>{variant[key]}</span></p>
          )}
        </div>
      ))}
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
