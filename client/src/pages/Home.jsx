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
          className="rounded-full border-2 border-charcoal flex items-center justify-center font-bold text-[#13130e] text-[8px] w-6 h-6"
          style={{ background: AVATAR_COLORS[i], marginLeft: i === 0 ? 0 : -6, zIndex: 5 - i }}
        >
          {l}
        </div>
      ))}
    </div>
  );
}

// ─── Ambient background ────────────────────────────────────────
function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {/* Islamic diamond lattice — very faint, culturally resonant */}
      <div className="absolute inset-0" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cg stroke='rgba(255,255,255,0.022)' stroke-width='0.6' fill='none'%3E%3Cpath d='M28 3 L53 28 L28 53 L3 28 Z'/%3E%3Cpath d='M28 17 L39 28 L28 39 L17 28 Z'/%3E%3C/g%3E%3C/svg%3E\")",
        backgroundSize: '56px 56px',
      }} />
      <div className="absolute rounded-full"
        style={{ width: '65vw', height: '65vw', top: '-25%', left: '-20%',
          background: 'radial-gradient(circle, rgba(196,119,90,0.07) 0%, transparent 55%)' }} />
      <div className="absolute rounded-full"
        style={{ width: '55vw', height: '55vw', bottom: '-15%', right: '-15%',
          background: 'radial-gradient(circle, rgba(232,197,71,0.06) 0%, transparent 55%)' }} />
      <div className="grain-overlay" />
    </div>
  );
}

// ─── Word card (recent words grid) ────────────────────────────
function WordCard({ entry }) {
  const [playing, setPlaying] = useState(false);
  const cardRef = useRef(null);

  function onMouseMove(e) {
    const el = cardRef.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width  - 0.5;
    const y = (e.clientY - top)  / height - 0.5;
    el.style.transition = 'transform 0.08s ease, box-shadow 0.08s ease';
    el.style.transform  = `perspective(700px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg) scale(1.03)`;
    el.style.boxShadow  = `${x * -12}px ${y * -12}px 28px rgba(232,197,71,0.1), inset 0 1px 0 rgba(255,255,255,0.08)`;
  }

  function onMouseLeave() {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.55s cubic-bezier(0.22,1,0.36,1), box-shadow 0.55s ease';
    el.style.transform  = '';
    el.style.boxShadow  = '';
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="bento-card w-full bg-white/[0.03] backdrop-blur-[24px] border border-white/[0.07] rounded-[16px] overflow-hidden flex flex-col h-full"
      style={{ borderLeft: '2px solid rgba(196,119,90,0.5)' }}
    >
      {/* Main content — grows to fill card height */}
      <div className="p-4 sm:p-5 flex flex-col gap-3 flex-1">

        {/* Pashto word + POS badge */}
        <div className="flex items-start justify-between gap-2">
          <div dir="rtl" className="pashto-bloom font-pashto text-warm font-bold text-2xl sm:text-3xl min-w-0" style={{ lineHeight: 1.7 }}>
            {entry.pashto}
          </div>
          <span className="font-ui text-warm/50 border border-white/[0.1] rounded-md text-[9px] px-1.5 py-0.5 shrink-0 mt-2.5 uppercase tracking-wider">
            {POS_SHORT[entry.partOfSpeech] || '—'}
          </span>
        </div>

        {/* Phonetic — gold, matches hero */}
        {entry.phonetic && (
          <div className="font-display italic text-gold/80 text-sm leading-none">{entry.phonetic}</div>
        )}

        {/* Separator */}
        <div className="h-px bg-white/[0.06]" />

        {/* Definition — warm, matches hero */}
        <p dir="ltr" className="font-display italic text-gold text-xs sm:text-sm leading-relaxed min-w-0 line-clamp-3 text-left flex-1">
          {entry.definitions?.[0]?.text}
        </p>

      </div>

      {/* Footer strip */}
      <div className="border-t border-white/[0.05] px-4 sm:px-5 py-2.5 flex items-center justify-end">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPlaying(p => !p); }}
          className="listen-btn flex items-center gap-1.5 text-muted/70 hover:text-warm/80 transition-colors rounded-full border border-transparent hover:border-white/[0.08] px-2 py-1"
        >
          <Waveform color={playing ? '#c4775a' : '#444'} animated={playing} />
          <span className="font-ui text-[9px] uppercase tracking-[0.1em]">{playing ? 'Playing' : 'Listen'}</span>
        </button>
      </div>
    </div>
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
  const [searchFocused,  setSearchFocused]  = useState(false);
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
      .catch(() => setError('Failed to load recent entries.'))
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

      {/* Search spotlight dimmer */}
      <div
        className="fixed inset-0 transition-opacity duration-300"
        style={{
          zIndex: 15,
          background: 'rgba(19,19,14,0.72)',
          backdropFilter: 'blur(5px)',
          opacity: searchFocused ? 1 : 0,
          pointerEvents: searchFocused ? 'auto' : 'none',
        }}
        onClick={() => { setSearchFocused(false); searchRef.current?.blur(); }}
      />

      <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 flex flex-col gap-4 sm:gap-5">

        {/* ── 1. Hero: Word of the Day ── */}
        <div
          className="bento-card gold-glow bg-white/[0.04] backdrop-blur-[40px] border border-white/[0.08] rounded-[48px] p-6 sm:p-8 lg:p-10 bento-enter"
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
            <div className="flex flex-col gap-6 sm:gap-8">

              {/* ── Calligraphy banner: full-width Pashto word ── */}
              <div className="text-center" style={{ animation: 'fadeSlideIn 0.6s ease both', animationDelay: '0.08s' }}>
                <div
                  dir="rtl"
                  className="pashto-bloom font-pashto text-warm font-bold select-none inline-block"
                  style={{
                    fontSize: 'clamp(64px, 12vw, 160px)',
                    lineHeight: 1.5,
                    textShadow: '0 0 60px rgba(232,197,71,0.1), 0 0 120px rgba(196,119,90,0.08)',
                  }}
                >
                  {wotd.pashto}
                </div>
                {/* Ornamental rule */}
                <div className="flex items-center justify-center gap-3 mt-3">
                  <div style={{ height: '1px', width: '60px', background: 'linear-gradient(to left, rgba(232,197,71,0.3), transparent)' }} />
                  <div className="w-1 h-1 rounded-full bg-gold/40" />
                  <div style={{ height: '1px', width: '60px', background: 'linear-gradient(to right, rgba(232,197,71,0.3), transparent)' }} />
                </div>
              </div>

              {/* ── Dictionary entry row ── */}
              <div className="flex flex-col sm:flex-row gap-5 sm:gap-10">

                {/* Left: phonetic + meta */}
                <div className="flex flex-col gap-3 sm:w-48 shrink-0" style={{ animation: 'fadeSlideIn 0.4s ease both', animationDelay: '0.22s' }}>
                  {wotd.phonetic && (
                    <div className="font-display italic text-gold leading-none"
                      style={{ fontSize: 'clamp(22px, 3vw, 36px)', textShadow: '0 0 24px rgba(232,197,71,0.4)' }}
                    >
                      {wotd.phonetic}
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {wotd.partOfSpeech && (
                      <span className="font-ui text-warm/70 border border-white/[0.1] rounded text-[10px] px-2 py-0.5 tracking-wide uppercase">
                        {wotd.partOfSpeech}
                      </span>
                    )}
                    <button
                      onClick={() => setWotdPlaying(p => !p)}
                      className="listen-btn flex items-center gap-1.5 border border-terracotta/35 rounded-full text-terracotta hover:bg-terracotta/10 text-xs px-3 py-1.5"
                    >
                      <Waveform color="#c4775a" animated={wotdPlaying} />
                      <span className="font-ui">{wotdPlaying ? 'Playing…' : 'Listen'}</span>
                    </button>
                  </div>
                  {wotd.submittedBy?.username && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[8px] shrink-0"
                        style={{ background: 'rgba(196,119,90,0.65)', color: '#fffef8' }}
                      >
                        {wotd.submittedBy.username[0].toUpperCase()}
                      </div>
                      <span className="font-ui text-muted text-xs">by {wotd.submittedBy.username}</span>
                    </div>
                  )}
                </div>

                {/* Right: definition + example + actions */}
                <div className="flex-1 min-w-0 flex flex-col gap-3" style={{ animation: 'fadeSlideIn 0.4s ease both', animationDelay: '0.32s' }}>
                  <p dir="ltr" className="font-display italic text-warm/85 text-base sm:text-lg lg:text-xl leading-relaxed min-w-0 text-left">
                    {wotd.definitions?.[0]?.text}
                  </p>

                  {wotd.definitions?.[0]?.example && (
                    <div className="border-l-2 border-gold/35 pl-4">
                      <p dir="ltr" className="font-display italic text-warm/55 text-sm min-w-0 text-left" style={{ lineHeight: 1.6 }}>
                        {wotd.definitions[0].example}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center flex-wrap gap-2 sm:gap-3 pt-1" style={{ animation: 'fadeSlideIn 0.4s ease both', animationDelay: '0.48s' }}>
                    <Link
                      to={`/entries/${wotd._id}`}
                      className="font-ui font-semibold text-warm bg-terracotta rounded-xl text-xs sm:text-sm px-4 sm:px-5 py-2.5 hover:opacity-90 transition-opacity"
                      style={{ boxShadow: '0 4px 20px rgba(196,119,90,0.35)' }}
                    >
                      Explore Word →
                    </Link>
                    <button className="font-ui text-warm/70 border border-white/[0.1] rounded-xl text-xs sm:text-sm px-4 sm:px-5 py-2.5 hover:border-white/20 hover:text-warm transition-all">
                      + Save Word
                    </button>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <p className="font-ui text-muted text-sm text-center py-8">No entries yet.</p>
          )}
        </div>

        {/* ── 2. Search ── */}
        <div
          className={`search-card bento-card bg-white/[0.035] backdrop-blur-[32px] border border-white/[0.08] rounded-3xl p-4 sm:p-5 bento-enter transition-all${searchFocused ? ' relative z-[20]' : ''}`}
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
              className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-10 pr-16 py-3 text-warm font-ui text-sm outline-none focus:border-terracotta/40 transition-colors placeholder:text-muted/60"
              placeholder="Search Pashto words…"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
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
              <span className="font-ui text-warm/70 text-[10px] uppercase tracking-[0.14em]">Recent Words</span>
              <Link to="/entries" className="font-ui text-mint hover:underline text-xs">View all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
              {wordCards.map((entry, i) => (
                <Link key={entry._id} to={`/entries/${entry._id}`} className="block bento-enter" style={{ animationDelay: `${0.28 + i * 0.08}s` }}>
                  <WordCard entry={entry} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. Community stats + CTA ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bento-enter" style={{ animationDelay: '0.45s' }}>

          {/* Community stats */}
          <div className="bento-card bg-white/[0.035] backdrop-blur-[32px] border border-white/[0.08] rounded-3xl p-5 sm:p-6 flex flex-col gap-4">
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
            className="bento-card rounded-3xl p-5 sm:p-6 flex flex-col justify-between gap-4"
            style={{
              background: 'linear-gradient(135deg, rgba(196,119,90,0.08) 0%, rgba(0,0,0,0.35) 100%)',
              border: '1px solid rgba(196,119,90,0.15)',
            }}
          >
            <div className="flex flex-col gap-2">
              <h3 className="font-ui font-semibold text-warm text-base sm:text-lg">Know a Pashto word?</h3>
              <p className="font-ui text-muted text-sm leading-relaxed">
                Help grow the dictionary. Every contribution makes Pashto more accessible online.
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse-soft shrink-0" />
                <span className="font-ui text-terracotta/70 text-xs">Others are contributing right now</span>
              </div>
            </div>
            <Link
              to={user ? '/submit' : '/register'}
              className="flex items-center justify-center gap-2 w-full rounded-xl font-ui font-semibold text-warm bg-terracotta hover:opacity-90 transition-opacity text-sm py-3"
              style={{ boxShadow: '0 4px 20px rgba(196,119,90,0.3)' }}
            >
              + Contribute a Word
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
