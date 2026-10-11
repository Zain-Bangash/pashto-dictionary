import { useState } from 'react';
import useLookups from '../../hooks/useLookups';
import SlotComparison from './SlotComparison';
import SuggestionRow from './SuggestionRow';
import SubmitterName from './SubmitterName';

// One word with every suggestion waiting on it, so competing proposals are reviewed together
export default function SuggestionGroup({ group, isAdmin, selection, itemOf, onFilterUser, onApprove, onReject, onPublish, onSaved }) {
  const { labelFor } = useLookups();
  const [open, setOpen] = useState(true);
  const { variant, suggestions } = group;
  const count = suggestions.length;

  return (
    <li className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-5 space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-4 text-left"
      >
        {variant ? (
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-warm font-display text-lg font-semibold">{variant.concept?.englishGloss}</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span dir="rtl" className="font-pashto text-warm text-2xl">{variant.pashto}</span>
              {variant.phonetic && <span className="font-ui text-sm text-muted">/{variant.phonetic}/</span>}
              <span className="font-ui text-xs px-2 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded-full text-muted/70">
                {labelFor('region', variant.region)}
              </span>
            </div>
            <p className="text-sm font-ui text-muted">{variant.definition}</p>
            <SubmitterName submitter={variant.submittedBy} prefix="Word by" />
          </div>
        ) : (
          <p className="text-sm font-ui text-muted italic">The word is no longer available</p>
        )}
        <span className="shrink-0 text-xs font-ui text-muted">{open ? '▾' : '▸'} {count} suggestion{count === 1 ? '' : 's'}</span>
      </button>

      {open && (
        <>
          <SlotComparison variant={variant} suggestions={suggestions} />
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <SuggestionRow
                key={s._id}
                suggestion={{ ...s, variant }}
                compact
                isAdmin={isAdmin}
                selected={selection?.has(s._id)}
                onSelect={selection ? () => selection.toggle(itemOf(s, variant)) : undefined}
                onFilterUser={onFilterUser}
                onApprove={onApprove}
                onReject={onReject}
                onPublish={onPublish}
                onSaved={onSaved}
              />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}
