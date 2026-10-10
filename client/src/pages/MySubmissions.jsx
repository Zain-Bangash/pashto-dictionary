import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import useLookups from '../hooks/useLookups';
import useMyVariants from '../hooks/useMyVariants';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/submissions/StatusBadge';
import ConceptResubmitForm from '../components/submissions/ConceptResubmitForm';
import CompletionFilters from '../components/submissions/CompletionFilters';
import MyVariantRow from '../components/submissions/MyVariantRow';
import MyRecordings from '../components/audio/MyRecordings';

const CARD = 'bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5';
const HEADING = 'text-xs font-ui font-semibold text-muted uppercase tracking-widest mb-3';

// Called before useMyVariants so the concepts request goes first
function useMyConcepts() {
  const [concepts, setConcepts] = useState([]);
  const [conceptsLoading, setConceptsLoading] = useState(true);
  const [conceptsError, setConceptsError] = useState('');
  useEffect(() => {
    api.get('/api/concepts/my-submissions')
      .then((res) => setConcepts(res.data.data || []))
      .catch(() => setConceptsError('Failed to load submissions'))
      .finally(() => setConceptsLoading(false));
  }, []);
  return { concepts, setConcepts, conceptsLoading, conceptsError };
}

function ConceptRow({ concept, onSaved }) {
  const { labelFor } = useLookups();
  const [editing, setEditing] = useState(false);
  return (
    <li className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 overflow-hidden">
          <p className="text-warm font-display text-lg font-semibold">{concept.englishGloss}</p>
          {concept.partOfSpeech && <span className="meta-label inline-block">{labelFor('partOfSpeech', concept.partOfSpeech)}</span>}
          {concept.status === 'rejected' && concept.moderatorNote && (
            <p className="text-xs font-ui text-red-400 mt-1">Note: {concept.moderatorNote}</p>
          )}
          {concept.status === 'rejected' && !editing && (
            <button onClick={() => setEditing(true)} className="mt-2 self-start text-xs font-ui font-semibold text-terracotta hover:opacity-80 transition-opacity">
              Edit &amp; Resubmit
            </button>
          )}
          {editing && (
            <ConceptResubmitForm concept={concept} onSave={(updated) => { setEditing(false); onSaved(updated); }} onCancel={() => setEditing(false)} />
          )}
        </div>
        <StatusBadge status={concept.status} />
      </div>
    </li>
  );
}

export default function MySubmissions() {
  const { user } = useAuth();
  const { concepts, setConcepts, conceptsLoading, conceptsError } = useMyConcepts();
  const [filters, setFilters] = useState({ completion: false, missing: '', region: '', page: 1 });
  const { variants, setVariants, meta, loading, loaded, error, reload } = useMyVariants(filters);

  if (conceptsLoading || (!loaded && loading)) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <p className="text-muted font-ui text-sm animate-pulse">Loading…</p>
    </div>
  );
  if (conceptsError || error) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <p className="text-red-400 font-ui text-sm">{conceptsError || error}</p>
    </div>
  );

  const filtering = filters.completion || filters.region;
  const isEmpty = concepts.length === 0 && variants.length === 0 && !filtering;
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const changeFilters = (changes) => setFilters((f) => ({ ...f, page: 1, ...changes }));

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display text-warm">My Submissions</h1>
            {user?.username && <p className="text-xs font-ui text-muted mt-1">{user.username}</p>}
          </div>
          <Link
            to="/submit"
            className="px-4 py-2 bg-terracotta text-warm text-sm font-ui font-semibold rounded-[10px] hover:opacity-90 transition-opacity shadow-[0_4px_20px_rgba(196,119,90,0.35)]"
          >
            + Submit New
          </Link>
        </div>

        {isEmpty ? (
          <p className="text-muted font-ui text-sm text-center py-20">No submissions yet.</p>
        ) : (
          <div className="space-y-8">
            {concepts.length > 0 && (
              <section>
                <h2 className={HEADING}>Concepts you submitted</h2>
                <ul className="space-y-3">
                  {concepts.map((c) => (
                    <ConceptRow key={c._id} concept={c} onSaved={(u) => setConcepts((prev) => prev.map((x) => (x._id === u._id ? u : x)))} />
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className={HEADING}>Variants you submitted</h2>
              <CompletionFilters count={meta.needsCompletionCount} {...filters} onChange={changeFilters} />
              {variants.length === 0 ? (
                <p className="text-muted font-ui text-sm py-6">{filters.completion ? 'Nothing needs completing.' : 'No words match these filters.'}</p>
              ) : (
                <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
                  {variants.map((v) => (
                    <MyVariantRow
                      key={v._id}
                      variant={v}
                      onChanged={(u) => setVariants((prev) => prev.map((x) => (x._id === u._id ? { ...x, ...u, concept: x.concept } : x)))}
                      onSuggested={reload}
                    />
                  ))}
                </ul>
              )}
              {totalPages > 1 && (
                <Pagination page={filters.page} totalPages={totalPages} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
              )}
            </section>
          </div>
        )}

        <div className="mt-8">
          <MyRecordings />
        </div>
      </div>
    </div>
  );
}
