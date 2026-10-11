import useLookups from '../../hooks/useLookups';
import useFieldDefinitions from '../../hooks/useFieldDefinitions';
import { formSlot, slotLabel, sortForms } from '../../utils/forms';

const TEXT_FIELDS = [
  { key: 'pashto', label: 'Pashto', rtl: true },
  { key: 'phonetic', label: 'Phonetic' },
  { key: 'definition', label: 'Definition' },
  { key: 'example', label: 'Example' },
];

function Change({ label, from, to, rtl }) {
  const dir = rtl ? 'rtl' : 'auto';
  return (
    <p className="text-xs font-ui text-muted">
      <span className="text-muted/50">{label}: </span>
      {from
        ? <del dir={dir} className={`text-muted/60 ${rtl ? 'font-pashto text-sm' : ''}`}>{from}</del>
        : <span className="text-muted/40 italic">blank</span>}
      <span className="text-muted/40 mx-1" aria-hidden="true">→</span>
      <ins dir={dir} className={`no-underline text-warm/90 ${rtl ? 'font-pashto text-sm' : ''}`}>{to}</ins>
    </p>
  );
}

// What a suggestion changes, old value → new value, followed by the word's other details for context.
// `baseline` holds the live values at the time of writing; a suggestion saved before overwrites existed has none and only filled blanks.
export default function EditDiff({ variant, proposed = {}, baseline, heading = 'Changes' }) {
  const { labelFor } = useLookups();
  const { fieldLabel } = useFieldDefinitions();
  const changed = TEXT_FIELDS.filter((f) => proposed[f.key]);
  const stale = variant && changed.some((f) => (baseline?.[f.key] ?? '') !== (variant[f.key] ?? ''));
  const unchanged = variant ? [
    ...TEXT_FIELDS.filter((f) => !proposed[f.key] && variant[f.key]).map((f) => ({ ...f, value: variant[f.key] })),
    ...(variant.region ? [{ key: 'region', label: 'Region', value: labelFor('region', variant.region) }] : []),
  ] : [];

  return (
    <>
      <section aria-label="Proposed details" className="mt-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-[10px] space-y-1">
        <p className="text-[10px] font-ui font-semibold text-muted uppercase tracking-wider">{heading}</p>
        {changed.map((f) => (
          <Change key={f.key} label={f.label} rtl={f.rtl} from={baseline?.[f.key]} to={proposed[f.key]} />
        ))}
        {Object.entries(proposed.extra ?? {}).map(([key, value]) => (
          <Change key={key} label={fieldLabel('variant', key)} to={value} />
        ))}
        {sortForms(proposed.forms).map((f) => (
          <Change
            key={formSlot(f)}
            label={`Form (${slotLabel(formSlot(f))})`}
            to={[f.pashto, f.phonetic && `/${f.phonetic}/`, f.example].filter(Boolean).join(' · ')}
          />
        ))}
        {stale && (
          <p role="status" className="text-[11px] font-ui text-gold/90">
            The word has changed since this was suggested — an admin must edit or reject it before it can be published.
          </p>
        )}
      </section>
      {unchanged.length > 0 && (
        <section aria-label="Unchanged details" className="mt-2 px-3 py-2 border border-white/[0.05] rounded-[10px] space-y-0.5">
          <p className="text-[10px] font-ui font-semibold text-muted/60 uppercase tracking-wider">Unchanged</p>
          {unchanged.map((f) => (
            <p key={f.key} className="text-xs font-ui text-muted/70">
              <span className="text-muted/40">{f.label}: </span>
              <span dir={f.rtl ? 'rtl' : 'auto'} className={f.rtl ? 'font-pashto text-sm' : ''}>{f.value}</span>
            </p>
          ))}
        </section>
      )}
    </>
  );
}
