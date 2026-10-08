import { useSearchParams } from 'react-router-dom';
import EntryQueue from '../../components/moderation/EntryQueue';
import SuggestionQueue from '../../components/moderation/SuggestionQueue';

const VIEWS = [['entries', 'Entries'], ['suggestions', 'Suggestions']];
const TAB = 'font-ui text-sm px-4 py-1.5 rounded-[10px] transition-colors';

export default function DashboardQueue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'suggestions' ? 'suggestions' : 'entries';

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-4">Moderation Queue</h1>
      <div role="tablist" aria-label="Queue" className="inline-flex gap-1 p-1 mb-5 bg-white/[0.03] border border-white/[0.08] rounded-[12px]">
        {VIEWS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={view === key}
            onClick={() => setSearchParams(key === 'entries' ? {} : { view: key })}
            className={`${TAB} ${view === key ? 'bg-white/[0.08] text-warm' : 'text-muted hover:text-warm'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'entries' ? <EntryQueue /> : <SuggestionQueue />}
    </div>
  );
}
