import { useState } from 'react';
import useLookups from '../../hooks/useLookups';

// One concept as a dropdown: the header stays visible with its action, the words open beneath it
export default function WantedConceptRow({ concept, count, action, children }) {
  const { labelFor } = useLookups();
  const [open, setOpen] = useState(false);
  const panelId = `wanted-${concept._id}`;

  return (
    <li className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[16px]">
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="min-w-0 flex-1 flex items-center gap-3 text-left group"
        >
          <span aria-hidden="true" className={`text-muted text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          <span className="min-w-0">
            <span className="block text-warm font-display text-lg font-semibold group-hover:text-gold transition-colors">{concept.englishGloss}</span>
            <span className="meta-label">{labelFor('partOfSpeech', concept.partOfSpeech)} · {count}</span>
          </span>
        </button>
        {action}
      </div>
      {open && (
        <div id={panelId} className="border-t border-white/[0.06] px-5 py-3">
          {children}
        </div>
      )}
    </li>
  );
}
