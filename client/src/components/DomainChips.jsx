import { Link } from 'react-router-dom';
import useLookups from '../hooks/useLookups';

// Links to Browse filtered by the domain; ghost pills because mint is kept for active filters
export default function DomainChips({ domains }) {
  const { labelFor } = useLookups();
  if (!domains?.length) return null;
  return (
    <ul aria-label="Domains" className="flex gap-2 flex-wrap">
      {domains.map((key) => (
        <li key={key}>
          <Link
            to={`/concepts?domain=${encodeURIComponent(key)}`}
            className="inline-block text-xs font-ui text-warm/70 bg-white/[0.04] border border-white/[0.1] rounded-full px-3 py-1 no-underline hover:text-warm hover:border-terracotta/50 transition-colors"
          >
            {labelFor('semanticDomain', key)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
