const BASE = 'inline-flex items-center justify-center sm:justify-start gap-2 rounded-full px-3.5 py-1.5 font-ui text-xs transition-all border';
const RECORD = `listen-btn ${BASE} font-semibold border-terracotta/40 text-terracotta hover:bg-terracotta/10`;
const GHOST = `${BASE} border-white/[0.1] text-warm/70 hover:text-warm hover:border-white/20`;
const OPEN = 'bg-white/[0.06] text-warm border-white/20';

// formsState: 'available' | 'open' (the user's suggestion is under review) | 'sent' | null (nothing to suggest)
export default function VariantActions({ panel, canRecord, formsState, onRecord, onAlsoSay, onSuggestForms }) {
  return (
    <div className="flex flex-col gap-2 pt-4 border-t border-white/[0.06] sm:pt-0 sm:border-t-0 sm:border-l sm:pl-5 sm:w-52 shrink-0">
      <p className="meta-label hidden sm:block mb-1">Contribute</p>
      <div className="flex flex-row flex-wrap sm:flex-col gap-2">
        {canRecord && (
          <button type="button" onClick={onRecord} aria-expanded={panel === 'record'} className={`${RECORD} ${panel === 'record' ? 'bg-terracotta/10' : ''}`}>
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-terracotta" />
            Record a pronunciation
          </button>
        )}
        <button type="button" onClick={onAlsoSay} title="Add this word for your region" className={GHOST}>
          + I also say this
        </button>
        {formsState === 'available' && (
          <button type="button" onClick={onSuggestForms} aria-expanded={panel === 'forms'} className={`${GHOST} ${panel === 'forms' ? OPEN : ''}`}>
            + Suggest forms
          </button>
        )}
      </div>
      {formsState === 'open' && <p className="text-[11px] font-ui text-muted/70">Your suggestion for this word is under review.</p>}
      {formsState === 'sent' && <p className="text-[11px] font-ui text-gold">Thanks — your forms will appear here once they are reviewed.</p>}
    </div>
  );
}
