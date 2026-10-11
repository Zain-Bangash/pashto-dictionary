const STEPS = ['Meaning', 'Word'];

export default function StepIndicator({ step }) {
  return (
    <ol className="flex items-center gap-3" aria-label="Progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const reached = step >= n;
        return (
          <li key={label} className="flex items-center gap-3 flex-1 last:flex-none">
            <span className="flex items-center gap-2" aria-current={step === n ? 'step' : undefined}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-ui font-bold ${reached ? 'bg-terracotta text-warm' : 'bg-white/10 text-muted'}`}>
                {n}
              </span>
              <span className={`text-xs font-ui uppercase tracking-wider ${reached ? 'text-warm' : 'text-muted'}`}>{label}</span>
            </span>
            {n < STEPS.length && <span className="flex-1 h-px bg-white/10" />}
          </li>
        );
      })}
    </ol>
  );
}
