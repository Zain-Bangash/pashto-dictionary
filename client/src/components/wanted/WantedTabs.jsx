import { Link } from 'react-router-dom';

const TABS = [['words', 'Words', '/wanted'], ['audio', 'Audio', '/wanted/audio']];
const TAB = 'font-ui text-sm px-4 py-1.5 rounded-[10px] transition-colors';

// Switching tab keeps the region and search; filters that belong to one tab and the page are reset
export default function WantedTabs({ current, region, q }) {
  const search = new URLSearchParams(Object.entries({ region, q }).filter(([, v]) => v)).toString();
  return (
    <nav aria-label="Wanted" className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-[12px] w-fit">
      {TABS.map(([key, label, path]) => (
        <Link
          key={key}
          to={search ? `${path}?${search}` : path}
          aria-current={current === key ? 'page' : undefined}
          className={`${TAB} ${current === key ? 'bg-white/[0.08] text-warm' : 'text-muted hover:text-warm'}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
