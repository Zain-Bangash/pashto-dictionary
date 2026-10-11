import { Link } from 'react-router-dom';
import useLookups from '../../hooks/useLookups';

// Other published meanings of the same written word, each with the regions that use it that way
export default function AlsoMeans({ meanings }) {
  const { labelFor } = useLookups();
  if (!meanings?.length) return null;

  return (
    <p className="text-xs font-ui text-muted">
      <span className="text-muted/60">Also means: </span>
      {meanings.map((m, i) => (
        <span key={m.conceptId}>
          {i > 0 && <span className="text-muted/40"> · </span>}
          <Link to={`/concepts/${m.conceptId}`} className="text-gold/80 hover:text-gold transition-colors">
            {m.englishGloss}
          </Link>
          <span className="text-muted/50"> ({m.regions.map((r) => labelFor('region', r)).join(', ')})</span>
        </span>
      ))}
    </p>
  );
}
