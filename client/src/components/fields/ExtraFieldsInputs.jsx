import useFieldDefinitions from '../../hooks/useFieldDefinitions';
import { optionLabel } from '../../context/fieldsValue';

const MAX = { text: 200, textarea: 2000 };

function FieldInput({ def, id, value, onChange, className, optionClassName }) {
  if (def.type === 'textarea') {
    return <textarea id={id} rows={3} maxLength={MAX.textarea} value={value} onChange={(e) => onChange(e.target.value)} className={className} />;
  }
  if (def.type === 'select') {
    const active = def.options.filter((o) => o.active);
    const retired = value && !active.some((o) => o.key === value);
    return (
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
        <option value="" className={optionClassName}>—</option>
        {active.map((o) => <option key={o.key} value={o.key} className={optionClassName}>{o.label}</option>)}
        {retired && <option value={value} className={optionClassName}>{optionLabel(def, value)} (retired)</option>}
      </select>
    );
  }
  return <input id={id} type="text" maxLength={MAX.text} value={value} onChange={(e) => onChange(e.target.value)} className={className} />;
}

export default function ExtraFieldsInputs({ appliesTo, values = {}, onChange, errors = {}, idPrefix = 'extra', inputClassName, labelClassName, optionClassName }) {
  const { forType, loading, error, reload } = useFieldDefinitions();
  const defs = forType(appliesTo);

  if (loading) return <p className="text-xs font-ui text-muted animate-pulse">Loading extra fields…</p>;
  if (error) {
    return (
      <p role="alert" className="text-red-400 text-xs font-ui">
        {error}.{' '}
        <button type="button" onClick={reload} className="underline hover:text-red-300">Retry</button>
      </p>
    );
  }

  return defs.map((def) => {
    const id = `${idPrefix}-${appliesTo}-${def.key}`;
    return (
      <div key={def.key}>
        <label htmlFor={id} className={labelClassName}>
          {def.label}
          {!def.required && <span className="normal-case text-muted/50"> (optional)</span>}
        </label>
        <FieldInput
          def={def}
          id={id}
          value={values[def.key] ?? ''}
          onChange={(v) => onChange(def.key, v)}
          className={inputClassName}
          optionClassName={optionClassName}
        />
        {errors[def.key] && <p className="text-red-400 text-xs font-ui mt-1">{errors[def.key]}</p>}
      </div>
    );
  });
}
