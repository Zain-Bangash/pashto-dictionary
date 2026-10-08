import { FORM_MAX, SLOTS, formSlot, slotFields, slotLabel } from '../../utils/forms';

export default function FormRow({ form, id, mismatched, usedSlots, onChange, onRemove, inputClassName, labelClassName }) {
  const slot = formSlot(form);
  const options = mismatched ? [form] : SLOTS[form.kind].filter((s) => formSlot(s) === slot || !usedSlots.has(formSlot(s)));
  const set = (key) => (e) => onChange({ ...form, [key]: e.target.value });

  return (
    <li className="space-y-2 bg-white/[0.02] border border-white/[0.06] rounded-[12px] p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor={`${id}-slot`} className={labelClassName}>Form</label>
          <select
            id={`${id}-slot`}
            value={slot}
            disabled={mismatched}
            onChange={(e) => onChange({ pashto: form.pashto, phonetic: form.phonetic, example: form.example, ...slotFields(e.target.value) })}
            className={inputClassName}
          >
            {options.map((s) => (
              <option key={formSlot(s)} value={formSlot(s)} className="bg-charcoal">{slotLabel(formSlot(s))}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${slotLabel(slot)} form`}
          className="px-3 py-2 text-xs font-ui text-red-400/80 hover:text-red-400 transition-colors"
        >
          Remove
        </button>
      </div>
      {mismatched && (
        <p className="text-[11px] font-ui text-amber-300/80">Doesn&apos;t match the part of speech — keep it or remove it.</p>
      )}
      <div>
        <label htmlFor={`${id}-pashto`} className={labelClassName}>Pashto</label>
        <input id={`${id}-pashto`} dir="rtl" required maxLength={FORM_MAX.pashto} value={form.pashto ?? ''} onChange={set('pashto')} className={`${inputClassName} font-pashto`} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-phonetic`} className={labelClassName}>Phonetic (optional)</label>
          <input id={`${id}-phonetic`} maxLength={FORM_MAX.phonetic} value={form.phonetic ?? ''} onChange={set('phonetic')} className={inputClassName} />
        </div>
        <div>
          <label htmlFor={`${id}-example`} className={labelClassName}>Example (optional)</label>
          <input id={`${id}-example`} dir="auto" maxLength={FORM_MAX.example} value={form.example ?? ''} onChange={set('example')} className={inputClassName} />
        </div>
      </div>
    </li>
  );
}
