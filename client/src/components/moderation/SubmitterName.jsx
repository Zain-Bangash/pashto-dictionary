import useLookups from '../../hooks/useLookups';

// "by name (village, region)"; with onFilter the name narrows the queue to that person
export default function SubmitterName({ submitter, prefix = 'by', onFilter }) {
  const { labelFor } = useLookups();
  if (!submitter?.username) return null;
  const place = [submitter.village, submitter.region && labelFor('region', submitter.region)].filter(Boolean).join(', ');
  return (
    <p className="text-xs font-ui text-muted/60">
      {prefix}{' '}
      {onFilter ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onFilter(submitter.username); }}
          title={`Show only ${submitter.username}'s submissions`}
          className="underline decoration-dotted underline-offset-2 hover:text-warm transition-colors"
        >
          {submitter.username}
        </button>
      ) : submitter.username}
      {place && <span className="ml-1">({place})</span>}
    </p>
  );
}
