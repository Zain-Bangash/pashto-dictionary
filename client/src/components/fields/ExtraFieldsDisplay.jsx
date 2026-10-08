import useFieldDefinitions from '../../hooks/useFieldDefinitions';
import { optionLabel } from '../../context/fieldsValue';

export default function ExtraFieldsDisplay({ appliesTo, values, className = '' }) {
  const { forType } = useFieldDefinitions();
  if (!values) return null;

  const rows = forType(appliesTo)
    .filter((def) => values[def.key])
    .map((def) => ({ def, text: def.type === 'select' ? optionLabel(def, values[def.key]) : values[def.key] }));
  if (rows.length === 0) return null;

  return (
    <dl className={`space-y-1 ${className}`}>
      {rows.map(({ def, text }) => (
        <div key={def.key} className="text-sm font-ui">
          <dt className="inline text-muted">{def.label}: </dt>
          <dd className={`inline text-warm/80 ${def.type === 'textarea' ? 'whitespace-pre-line' : ''}`}>{text}</dd>
        </div>
      ))}
    </dl>
  );
}
