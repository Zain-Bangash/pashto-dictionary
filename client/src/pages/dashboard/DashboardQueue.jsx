import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import EntryQueue from '../../components/moderation/EntryQueue';
import SuggestionQueue from '../../components/moderation/SuggestionQueue';
import AudioQueue from '../../components/audio/AudioQueue';
import useSharedStats from '../../hooks/useSharedStats';
import { waitingIn } from '../../utils/queueCounts';

const VIEWS = [['entries', 'Entries'], ['suggestions', 'Suggestions'], ['audio', 'Audio']];
const QUEUES = { entries: EntryQueue, suggestions: SuggestionQueue, audio: AudioQueue };
const TAB = 'shrink-0 flex items-center gap-2 font-ui text-sm px-4 py-1.5 rounded-[10px] transition-colors';

export default function DashboardQueue() {
  const { user } = useAuth() ?? {};
  const stats = useSharedStats()?.stats;
  const [searchParams, setSearchParams] = useSearchParams();
  const view = QUEUES[searchParams.get('view')] ? searchParams.get('view') : 'entries';
  const Queue = QUEUES[view];

  // Switching tab keeps search, region and submitter (handy for clearing one person's spam) but resets status and page
  const switchTo = (key) => {
    const next = new URLSearchParams(searchParams);
    ['view', 'status', 'page'].forEach((k) => next.delete(k));
    if (key !== 'entries') next.set('view', key);
    setSearchParams(next);
  };

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-4">Moderation Queue</h1>
      <div role="tablist" aria-label="Queue" className="flex max-w-full overflow-x-auto gap-1 p-1 mb-5 bg-white/[0.03] border border-white/[0.08] rounded-[12px] w-fit">
        {VIEWS.map(([key, label]) => {
          const waiting = waitingIn(stats, key, user?.role === 'admin');
          return (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => switchTo(key)}
              className={`${TAB} ${view === key ? 'bg-white/[0.08] text-warm' : 'text-muted hover:text-warm'}`}
            >
              {label}
              {waiting > 0 && <span className="text-[10px] font-semibold text-gold">{waiting}</span>}
            </button>
          );
        })}
      </div>
      <Queue key={view} />
    </div>
  );
}
