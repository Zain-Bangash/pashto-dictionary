import { useState } from 'react';
import FormsEditor from './FormsEditor';
import { formSlot, formsPayload } from '../../utils/forms';
import { inputCls, labelCls, PRIMARY_BTN, CANCEL_BTN } from '../submissions/styles';

// Forms-only suggestion for someone else's word; filled slots on the live word cannot be picked
export default function ContributeFormsForm({ kind, liveForms = [], initialForms = [], idPrefix, submitLabel, onSubmit, onCancel }) {
  const [forms, setForms]   = useState(initialForms);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!forms.length || forms.some((f) => !f.pashto?.trim())) {
      setError('Add at least one form and fill in its Pashto');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit(formsPayload(forms));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to send suggestion');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Suggest forms" className="mt-3 space-y-3 border-t border-white/[0.08] pt-3">
      <p className="text-[11px] font-ui text-muted/70">
        Your forms are reviewed by a moderator and published by an admin. Once published they show your name.
      </p>
      <FormsEditor
        kind={kind}
        forms={forms}
        onChange={setForms}
        takenSlots={liveForms.map(formSlot)}
        idPrefix={idPrefix}
        inputClassName={inputCls}
        labelClassName={labelCls}
      />
      {error && <p role="alert" className="text-xs font-ui text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={PRIMARY_BTN}>{saving ? 'Sending…' : submitLabel}</button>
        <button type="button" onClick={onCancel} className={CANCEL_BTN}>Cancel</button>
      </div>
    </form>
  );
}
