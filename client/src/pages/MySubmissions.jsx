import { useState, createElement } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useSubmissionSummary from '../hooks/useSubmissionSummary';
import SubmissionSection from '../components/submissions/SubmissionSection';
import SummaryStrip from '../components/submissions/SummaryStrip';
import MyConceptsSection from '../components/submissions/MyConceptsSection';
import MyVariantsSection from '../components/submissions/MyVariantsSection';
import MySuggestions from '../components/submissions/MySuggestions';
import MyRecordings from '../components/audio/MyRecordings';

const SECTIONS = [
  { id: 'concepts', title: 'Concepts', Body: MyConceptsSection },
  { id: 'variants', title: 'Variants', Body: MyVariantsSection },
  { id: 'audio', title: 'Recordings', Body: MyRecordings },
  { id: 'suggestions', title: 'Forms you suggested', Body: MySuggestions },
];
const NO_STATUS = { concepts: '', variants: '', audio: '', suggestions: '' };

export default function MySubmissions() {
  const { user } = useAuth();
  const { summary, refresh } = useSubmissionSummary();
  const [open, setOpen] = useState({});
  const [statuses, setStatuses] = useState(NO_STATUS);

  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const setStatus = (id, status) => setStatuses((s) => ({ ...s, [id]: status }));

  // A summary tile opens every section that has submissions in that status, filtered to it
  const pick = (status) => {
    const hits = SECTIONS.filter(({ id }) => (summary?.[id]?.[status] ?? 0) > 0).map(({ id }) => id);
    setOpen((o) => ({ ...o, ...Object.fromEntries(hits.map((id) => [id, true])) }));
    setStatuses((s) => ({ ...s, ...Object.fromEntries(hits.map((id) => [id, status])) }));
  };

  const isEmpty = summary && SECTIONS.every(({ id }) => (summary[id]?.total ?? 0) === 0);

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
          <>
            {summary && <SummaryStrip summary={summary} onPick={pick} />}
            <div className="space-y-4">
              {SECTIONS.map(({ id, title, Body }) => {
                const counts = summary?.[id];
                if (id === 'suggestions' && counts?.total === 0) return null;
                return (
                  <SubmissionSection
                    key={id}
                    id={id}
                    title={title}
                    total={counts?.total}
                    attention={counts?.rejected}
                    open={Boolean(open[id])}
                    onToggle={() => toggle(id)}
                  >
                    {createElement(Body, { counts, status: statuses[id], onStatusChange: (s) => setStatus(id, s), onMutated: refresh })}
                  </SubmissionSection>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
