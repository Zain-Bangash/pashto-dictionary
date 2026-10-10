import { formSlot, slotLabel, sortForms } from '../../utils/forms';

const BADGE = 'text-[10px] font-ui font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider';

// Every proposed form slot across a word's suggestions, side by side. Only one proposal per slot can be
// published; the rest are refused at publish, so conflicts are flagged here before anyone approves.
export default function SlotComparison({ variant, suggestions }) {
  const filled = new Set((variant?.forms ?? []).map(formSlot));
  const bySlot = new Map();
  for (const s of suggestions) {
    for (const f of sortForms(s.proposed?.forms)) {
      const slot = formSlot(f);
      if (!bySlot.has(slot)) bySlot.set(slot, []);
      bySlot.get(slot).push({ form: f, by: s.submittedBy?.username, id: s._id });
    }
  }
  if (!bySlot.size) return null;

  return (
    <table className="w-full text-xs font-ui border border-white/[0.06] rounded-[10px] overflow-hidden">
      <caption className="sr-only">Proposed forms by slot</caption>
      <thead>
        <tr className="text-[10px] text-muted/60 uppercase tracking-wider text-left">
          <th scope="col" className="px-3 py-1.5 font-semibold">Form</th>
          <th scope="col" className="px-3 py-1.5 font-semibold">Proposals</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.06]">
        {[...bySlot.entries()].map(([slot, proposals]) => (
          <tr key={slot} className="align-top">
            <th scope="row" className="px-3 py-2 text-left font-normal text-muted">
              <span className="block">{slotLabel(slot)}</span>
              {filled.has(slot) && <span className={`${BADGE} mt-1 inline-block text-red-300 bg-red-400/10 border border-red-400/30`}>Already filled</span>}
              {!filled.has(slot) && proposals.length > 1 && (
                <span className={`${BADGE} mt-1 inline-block text-amber-300 bg-amber-400/10 border border-amber-400/30`}>Conflict</span>
              )}
            </th>
            <td className="px-3 py-2">
              <ul className="space-y-1">
                {proposals.map((p) => (
                  <li key={p.id} className="flex items-baseline gap-2 flex-wrap">
                    <span dir="rtl" className="font-pashto text-warm text-base">{p.form.pashto}</span>
                    {p.form.phonetic && <span className="text-muted/70">/{p.form.phonetic}/</span>}
                    <span className="text-muted/50">— {p.by ?? 'unknown'}</span>
                  </li>
                ))}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
