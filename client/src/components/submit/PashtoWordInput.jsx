import { inputClass, labelClass, errorClass } from './submitStyles';

// The headword with a large preview and a hint when the same word exists under another concept
export default function PashtoWordInput({ value, onChange, onBlur, warnings, error }) {
  return (
    <div>
      <label htmlFor="pashto" className={labelClass}>Pashto Word</label>
      <input
        id="pashto"
        type="text"
        dir="rtl"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`${inputClass} font-pashto text-lg`}
        placeholder="پښتو…"
      />
      {value && (
        <div dir="rtl" className="mt-2 font-pashto text-gold text-3xl">{value}</div>
      )}
      {warnings.length > 0 && (
        <div dir="ltr" className="mt-2 rounded-[12px] bg-gold/[0.08] border border-gold/30 px-3 py-2 text-sm font-ui text-gold">
          <span className="font-semibold">Note:</span> This word already appears under{' '}
          {warnings.map((c, i) => (
            <span key={c.conceptId}>
              {i > 0 && ', '}
              <span className="font-semibold text-warm">{c.englishGloss}</span>{' '}
              <span className="text-gold/70">({c.status})</span>
            </span>
          ))}
          . If it shares that meaning, consider selecting that concept in Step 1 instead.
        </div>
      )}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}
