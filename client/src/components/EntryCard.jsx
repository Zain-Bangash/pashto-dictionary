import { Link } from 'react-router-dom';

export default function EntryCard({ entry }) {
  const firstDef = entry.definitions?.[0]?.text ?? '';
  const truncated = firstDef.length > 80 ? firstDef.slice(0, 80) + '…' : firstDef;

  return (
    <Link
      to={`/entries/${entry._id}`}
      className="block bg-white border border-neutral-200 rounded-lg p-4 hover:border-neutral-400 hover:shadow-sm transition-all"
    >
      <p className="text-xl font-semibold text-neutral-900">{entry.pashto}</p>
      {entry.phonetic && (
        <p className="text-sm text-neutral-500 mt-1">{entry.phonetic}</p>
      )}
      {truncated && (
        <p className="text-sm text-neutral-700 mt-2">{truncated}</p>
      )}
    </Link>
  );
}
