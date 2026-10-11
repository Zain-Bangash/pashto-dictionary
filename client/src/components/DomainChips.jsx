import { Link } from 'react-router-dom';
import useLookups from '../hooks/useLookups';

export default function DomainChips({ domains }) {
  const { labelFor } = useLookups();
  if (!domains?.length) return null;
  return (
    <ul aria-label="Domains" className="flex gap-2 flex-wrap">
      {domains.map((key) => (
        <li key={key}>
          <Link
            to={`/concepts?domain=${encodeURIComponent(key)}`}
            className="inline-block text-xs font-ui text-mint/80 bg-mint/[0.06] border border-mint/20 rounded-full px-3 py-1 no-underline hover:text-mint hover:border-mint/40 transition-colors"
          >
            {labelFor('semanticDomain', key)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
