import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const POS_SHORT = { noun: 'N.', verb: 'V.', adjective: 'Adj.', adverb: 'Adv.', phrase: 'Ph.', other: '—' };

// ─── Waveform ──────────────────────────────────────────────────
function Waveform({ color = '#00f5b4', animated = false }) {
  const heights = [3, 6, 9, 5, 9, 6, 3];
  const delays  = [0, 0.18, 0.36, 0.27, 0.09, 0.45, 0.13];
  return (
    <svg width="18" height="12" viewBox="0 0 22 16" className="shrink-0">
      {heights.map((h, i) => (
        <rect key={i}
          className={animated ? 'wave-active' : 'wave-idle'}
          x={i * 3} y={(16 - h) / 2} width="2" height={h} rx="1"
          fill={color}
          style={{ transformOrigin: 'center', animationDelay: `${delays[i]}s` }}
        />
      ))}
    </svg>
  );
}

// ─── Avatar stack ──────────────────────────────────────────────
const AVATAR_COLORS   = ['#e8c547', '#00f5b4', '#f87171', '#818cf8', '#fb923c'];
const AVATAR_INITIALS = ['K', 'A', 'S', 'M', 'Z'];

function AvatarStack() {
  return (
    <div className="flex items-center">
      {AVATAR_INITIALS.map((l, i) => (
        <div key={i}
          className="rounded-full border-2 border-[#0a0a0a] flex items-center justify-center font-bold text-[#0a0a0a] text-[8px] w-6 h-6"
          style={{ background: AVATAR_COLORS[i], marginLeft: i === 0 ? 0 : -6, zIndex: 5 - i }}
        >
          {l}
        </div>
      ))}
    </div>
  );
}

// ─── Ambient blobs ─────────────────────────────────────────────
function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <div className="absolute rounded-full opacity-60"
        style={{ width: '60vw', height: '60vw', top: '-20%', left: '-20%',
          background: 'radial-gradient(circle, rgba(0,245,180,0.07) 0%, transparent 60%)' }} />
      <div className="absolute rounded-full opacity-60"
        style={{ width: '50vw', height: '50vw', bottom: '-10%', right: '-10%',
          background: 'radial-gradient(circle, rgba(232,197,71,0.06) 0%, transparent 60%)' }} />
      <div className="grain-overlay" />
    </div>
  );
}

// ─── Word card (recent words grid) ────────────────────────────
function WordCard({ entry }) {
  const [playing, setPlaying] = useState(false);
  return (
    <button
      onClick={() => setPlaying(p => !p)}
      className="bento-card w-full text-left bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col gap-2 relative overflow-hidden group transition-all duration-200 hover:-translate-y-0.5 bento-enter"
    >
      {/* Ghost watermark */}
      <div aria-hidden="true"
        className="absolute bottom-1 right-2 font-pashto text-white/[0.04] pointer-events-none select-none text-5xl sm:text-6xl leading-none"
        style={{ direction: 'rtl' }}
      >
        {entry.pashto}
      </div>

      <div dir="rtl" className="font-pashto text-warm font-bold text-2xl sm:text-3xl min-w-0 relative" style={{ lineHeight: 1.7 }}>
        {entry.pashto}
      </div>

      {entry.phonetic && (
        <div className="font-display italic text-muted text-xs sm:text-sm">{entry.phonetic}</div>
      )}

      <p className="font-ui text-muted text-xs leading-snug line-clamp-2 flex-1 relative min-w-0">
        {entry.definitions?.[0]?.text}
      </p>

      <div className="flex items-center justify-between mt-1 relative">
        <span className="font-ui text-muted border border-white/[0.1] rounded text-[9px] px-1.5 py-0.5">
          {POS_SHORT[entry.partOfSpeech] || '—'}
        </span>
        <Waveform color={playing ? '#00f5b4' : '#333'} animated={playing} />
      </div>
    </button>
  );
}

// ─── Home ──────────────────────────────────────────────────────
export default function Home() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const searchRef = useRef(null);

  const [entries,        setEntries]        = useState([]);
  const [total,          setTotal]          = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [wotdPlaying,    setWotdPlaying]    = useState(false);
  const [activeFilter,   setActiveFilter]   = useState(null);
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pashto_recent') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    api.get('/api/entries?status=published&limit=4')
      .then(res => {
        setEntries(res.data.data || []);
        setTotal(res.data.meta?.total || 0);
      })
      .catch(() => setError('Failed to load entries.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 3);
      setRecentSearches(updated);
      try { localStorage.setItem('pashto_recent', JSON.stringify(updated)); } catch {}
      navigate(`/entries?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/entries');
    }
  }, [searchQuery, navigate, recentSearches]);

  const wotd      = entries[0] || null;
  const wordCards = entries.slice(1, 4);

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  const addedThisMonth = entries.filter(e => new Date(e.createdAt) >= thisMonthStart).length;

  const heroDate = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  }).toUpperCase();

  if (loading) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <span className="text-muted font-ui text-sm animate-pulse">Loading…</span>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <span className="text-red-400 font-ui text-sm">{error}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-charcoal">
      <AmbientBackground />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 flex flex-col gap-4 sm:gap-5">

        {/* ── 1. Hero: Word of the Day ── */}
        <div
          className="bento-card gold-glow bg-white/[0.04] backdrop-blur-[40px] border border-white/[0.08] rounded-2xl p-6 sm:p-8 lg:p-10 bento-enter"
          style={{ animationDelay: '0.05s' }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between mb-5 sm:mb-7">
            <div className="flex items-center gap-2">
              <span className="meta-label">Word of the Day</span>
              <div className="inline-flex items-center gap-1.5 bg-black/40 border border-mint/25 rounded-full px-2.5 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse-soft" style={{ boxShadow: '0 0 6px #00f5b4' }} />
                <span className="font-ui font-semibold text-mint text-[9px] tracking-widest">LIVE</span>
              </div>
            </div>
            <span className="font-ui text-muted text-[10px] sm:text-xs tracking-wide hidden sm:block">{heroDate}</span>
          </div>

          {wotd ? (
            /* Two-column on sm+: text left, big Pashto word right */
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">

              {/* Left: text content */}
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                {/* Phonetic + POS + Listen */}
                <div className="flex items-center flex-wrap gap-2 sm:gap-3">
                  {wotd.phonetic && (
                    <span
                      className="font-display italic text-gold text-2xl sm:text-3xl lg:text-4xl"
                      style={{ textShadow: '0 0 24px rgba(232,197,71,0.5)' }}
                    >
                      {wotd.phonetic}
                    </span>
                  )}
                  {wotd.partOfSpeech && (
                    <span className="font-ui text-muted border border-white/[0.1] rounded text-[10px] px-2 py-0.5 tracking-wide uppercase">
                      {wotd.partOfSpeech}
                    </span>
                  )}
                  <button
                    onClick={() => setWotdPlaying(p => !p)}
                    className="flex items-center gap-1.5 border border-mint/30 rounded-full text-mint hover:bg-mint/10 transition-colors text-xs px-3 py-1.5"
                  >
                    <Waveform color="#00f5b4" animated={wotdPlaying} />
                    <span className="font-ui">{wotdPlaying ? 'Playing…' : 'Listen'}</span>
                  </button>
                </div>

                {/* Definition */}
                <p className="font-ui text-warm/80 text-sm sm:text-base lg:text-lg leading-relaxed min-w-0">
                  {wotd.definitions?.[0]?.text}
                </p>

                {/* Example */}
                {wotd.definitions?.[0]?.example && (
                  <div className="border-l-2 border-gold/50 pl-4">
                    <p dir="rtl" className="font-pashto text-warm/60 text-sm min-w-0" style={{ lineHeight: 1.7 }}>
                      {wotd.definitions[0].example}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center flex-wrap gap-2 sm:gap-3 pt-1">
                  <Link
                    to={`/entries/${wotd._id}`}
                    className="font-ui font-semibold text-charcoal bg-gold rounded-xl text-xs sm:text-sm px-4 sm:px-5 py-2.5 hover:opacity-90 transition-opacity"
                    style={{ boxShadow: '0 4px 20px rgba(232,197,71,0.3)' }}
                  >
                    Explore Word →
                  </Link>
                  <button className="font-ui text-warm border border-white/[0.12] rounded-xl text-xs sm:text-sm px-4 sm:px-5 py-2.5 hover:border-white/25 transition-colors">
                    + Save Word
                  </button>
                  {wotd.submittedBy?.username && (
                    <div className="flex items-center gap-1.5 sm:ml-auto">
                      <div className="w-5 h-5 rounded-full bg-mint flex items-center justify-center text-charcoal font-bold text-[8px] shrink-0">
                        {wotd.submittedBy.username[0].toUpperCase()}
                      </div>
                      <span className="font-ui text-muted text-xs">by {wotd.submittedBy.username}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: large Pashto word — decorative */}
              <div
                dir="rtl"
                className="font-pashto text-warm font-bold shrink-0 text-center sm:text-right
                           text-6xl sm:text-7xl lg:text-8xl xl:text-9xl
                           opacity-90 select-none"
                style={{ lineHeight: 1.7, textShadow: '0 0 60px rgba(0,245,180,0.07)' }}
              >
                {wotd.pashto}
              </div>
            </div>
          ) : (
            <p className="font-ui text-muted text-sm text-center py-8">No word of the day yet.</p>
          )}
        </div>

        {/* ── 2. Search ── */}
        <div
          className="bento-card bg-white/[0.035] backdrop-blur-[32px] border border-white/[0.08] rounded-2xl p-4 sm:p-5 bento-enter"
          style={{ animationDelay: '0.15s' }}
        >
          <form onSubmit={handleSearch} className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-10 pr-16 py-3 text-warm font-ui text-sm outline-none focus:border-mint/50 transition-colors placeholder:text-muted/60"
              placeholder="Search Pashto words…"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white/[0.06] border border-white/10 rounded px-1.5 py-0.5 font-ui text-muted text-[9px] pointer-events-none">
              <span>⌘</span><span>K</span>
            </div>
            <button type="submit" className="sr-only">Search</button>
          </form>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {['All', 'Nouns', 'Verbs', 'Phrases', 'A–Z'].map(f => (
              <button
                key={f}
                onClick={() => {
                  setActiveFilter(activeFilter === f ? null : f);
                  if (f !== 'All') navigate(`/entries?q=${encodeURIComponent(f.toLowerCase())}`);
                  else navigate('/entries');
                }}
                className="font-ui rounded-full text-xs px-3 py-1.5 transition-all"
                style={{
                  background: activeFilter === f ? 'rgba(0,245,180,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${activeFilter === f ? 'rgba(0,245,180,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: activeFilter === f ? '#00f5b4' : '#666',
                }}
              >
                {f}
              </button>
            ))}

            {recentSearches.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="font-ui text-muted/60 text-[9px] uppercase tracking-widest hidden sm:block">Recent:</span>
                {recentSearches.map(s => (
                  <button
                    key={s}
                    onClick={() => navigate(`/entries?q=${encodeURIComponent(s)}`)}
                    className="font-ui text-muted hover:text-warm transition-colors text-xs flex items-center gap-1"
                  >
                    <span className="w-1 h-1 rounded-full bg-mint/50 shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Recent words ── */}
        {wordCards.length > 0 && (
          <div className="bento-enter" style={{ animationDelay: '0.25s' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-ui text-muted text-[10px] uppercase tracking-[0.14em]">Recent Words</span>
              <Link to="/entries" className="font-ui text-mint hover:underline text-xs">View all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {wordCards.map((entry, i) => (
                <Link key={entry._id} to={`/entries/${entry._id}`} className="block" style={{ textDecoration: 'none', animationDelay: `${0.28 + i * 0.08}s` }}>
                  <WordCard entry={entry} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. Community stats + CTA ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bento-enter" style={{ animationDelay: '0.45s' }}>

          {/* Community stats */}
          <div className="bento-card bg-white/[0.035] backdrop-blur-[32px] border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
            <h2 className="font-ui font-semibold text-muted text-[10px] uppercase tracking-[0.14em]">Community</h2>
            <div className="flex flex-col gap-3">

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base" style={{ background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.2)' }}>
                  <span>⚡</span>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xl text-gold leading-none">{total.toLocaleString()}</div>
                  <div className="font-ui text-muted text-xs mt-0.5">Words published</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base" style={{ background: 'rgba(0,245,180,0.1)', border: '1px solid rgba(0,245,180,0.2)' }}>
                  <span>◎</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xl text-mint leading-none">5</div>
                  <div className="font-ui text-muted text-xs mt-0.5">Contributors</div>
                </div>
                <AvatarStack />
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base" style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <span>+</span>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xl leading-none" style={{ color: '#a78bfa' }}>{addedThisMonth}</div>
                  <div className="font-ui text-muted text-xs mt-0.5">Added this month</div>
                </div>
              </div>

            </div>
          </div>

          {/* Contribute CTA */}
          <div
            className="bento-card rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4"
            style={{
              background: 'linear-gradient(135deg, rgba(0,245,180,0.08) 0%, rgba(0,0,0,0.35) 100%)',
              border: '1px solid rgba(0,245,180,0.12)',
            }}
          >
            <div className="flex flex-col gap-2">
              <h3 className="font-ui font-semibold text-warm text-base sm:text-lg">Know a Pashto word?</h3>
              <p className="font-ui text-muted text-sm leading-relaxed">
                Help grow the dictionary. Every contribution makes Pashto more accessible online.
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse-soft shrink-0" />
                <span className="font-ui text-mint/70 text-xs">Others are contributing right now</span>
              </div>
            </div>
            <Link
              to={user ? '/submit' : '/register'}
              className="flex items-center justify-center gap-2 w-full rounded-xl font-ui font-semibold text-charcoal bg-mint hover:opacity-90 transition-opacity text-sm py-3"
              style={{ boxShadow: '0 4px 20px rgba(0,245,180,0.25)' }}
            >
              + Contribute a Word
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
