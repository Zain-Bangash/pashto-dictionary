import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Waveform SVG component ────────────────────────────────────
function Waveform({ color = '#00f5b4', animated = false }) {
  const heights = [3, 6, 9, 5, 9, 6, 3];
  const delays = [0, 0.18, 0.36, 0.27, 0.09, 0.45, 0.13];
  return (
    <svg width="22" height="16" viewBox="0 0 22 16">
      {heights.map((h, i) => (
        <rect
          key={i}
          className={animated ? 'wave-active' : 'wave-idle'}
          x={i * 3}
          y={(16 - h) / 2}
          width="2"
          height={h}
          rx="1"
          fill={color}
          style={{ transformOrigin: 'center', animationDelay: `${delays[i]}s` }}
        />
      ))}
    </svg>
  );
}

// ─── Avatar stack ──────────────────────────────────────────────
const AVATAR_COLORS = ['#e8c547', '#00f5b4', '#f87171', '#818cf8', '#fb923c'];
const AVATAR_INITIALS = ['K', 'A', 'S', 'M', 'Z'];

function AvatarStack() {
  return (
    <div className="flex items-center">
      {AVATAR_INITIALS.map((l, i) => (
        <div
          key={i}
          className="w-[22px] h-[22px] rounded-full border-2 border-charcoal flex items-center justify-center text-[8px] font-bold text-charcoal"
          style={{ background: AVATAR_COLORS[i], marginLeft: i === 0 ? 0 : -7, zIndex: 5 - i }}
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
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute -top-48 -left-24 w-[600px] h-[600px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(0,245,180,0.07) 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-48 -right-24 w-[700px] h-[700px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(232,197,71,0.055) 0%, transparent 70%)' }}
      />
      <div className="grain-overlay" />
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────
function Stat({ value, label, color }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-[11px] font-ui text-muted">{label}</span>
    </div>
  );
}

// ─── Word tile (row 3) ─────────────────────────────────────────
function WordTile({ entry, delay }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div
      className="bento-card mint-glow bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5 relative overflow-hidden flex flex-col justify-between cursor-pointer bento-enter"
      style={{ animationDelay: delay }}
      onClick={() => setPlaying((p) => !p)}
    >
      {/* Ghost watermark — CSS ::before so DOM text queries skip it */}
      <div
        aria-hidden="true"
        className="ghost-word absolute bottom-2 right-2 text-white/[0.03] pointer-events-none select-none"
        data-word={entry.pashto}
        style={{ fontSize: 72, direction: 'rtl' }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 overflow-hidden">
          <span className="meta-label">{entry.partOfSpeech || 'word'}</span>
          <div dir="rtl" className="font-pashto text-warm text-2xl" style={{ lineHeight: 1.7 }}>
            {entry.pashto}
          </div>
          <p className="text-[12px] text-muted font-ui leading-snug line-clamp-2">
            {entry.definitions?.[0]?.text}
          </p>
        </div>
        <Waveform color="#00f5b4" animated={playing} />
      </div>
    </div>
  );
}

// ─── Home ──────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [wotdPlaying, setWotdPlaying] = useState(false);

  useEffect(() => {
    api.get('/api/entries?status=published&limit=4')
      .then((res) => {
        setEntries(res.data.data || []);
        setTotal(res.data.meta?.total || 0);
      })
      .catch(() => setError('Failed to load recent entries.'))
      .finally(() => setLoading(false));
  }, []);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSearch = useCallback(
    (e) => {
      e.preventDefault();
      if (searchQuery.trim()) navigate(`/entries?q=${encodeURIComponent(searchQuery.trim())}`);
      else navigate('/entries');
    },
    [searchQuery, navigate]
  );

  const wotd = entries[0] || null;
  const wordTiles = entries.slice(1, 4);

  // "Added this month" count — rough client-side filter
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  const addedThisMonth = entries.filter(
    (e) => new Date(e.createdAt) >= thisMonthStart
  ).length;

  const ctaTarget = user ? '/submit' : '/register';

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <span className="text-muted font-ui text-sm animate-pulse">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <span className="text-red-400 font-ui text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal relative overflow-hidden">
      <AmbientBackground />

      <div
        className="relative z-10 p-3 pb-5 gap-3"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 310px',
          gridTemplateRows: '1fr 1fr 170px',
          minHeight: 'calc(100vh - 56px)',
        }}
      >
        {/* ── Hero tile (WOTD) ── */}
        <div
          className="bento-card gold-glow bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-10 flex flex-col justify-end relative overflow-hidden bento-enter"
          style={{ gridColumn: '1/4', gridRow: '1/3', animationDelay: '0.05s' }}
        >
          {wotd ? (
            <>
              {/* Ghost script — rendered via CSS ::before so DOM text queries skip it */}
              <div
                aria-hidden="true"
                className="ghost-word absolute pointer-events-none select-none text-white/[0.028]"
                data-word={wotd.pashto}
                style={{
                  fontSize: 360,
                  top: '48%',
                  right: -80,
                  transform: 'translateY(-50%) rotate(-8deg)',
                  direction: 'rtl',
                }}
              />

              <div className="relative flex flex-col gap-3">
                {/* LIVE badge */}
                <div className="inline-flex items-center gap-1.5 bg-black/40 border border-mint/25 rounded-full px-2.5 py-1 w-fit">
                  <div className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse-soft" style={{ boxShadow: '0 0 8px #00f5b4' }} />
                  <span className="text-[10px] font-semibold text-mint tracking-widest font-ui">LIVE</span>
                </div>

                {/* Main Pashto word */}
                <div
                  className="shimmer-text font-pashto font-bold"
                  style={{ fontSize: 96, direction: 'rtl', lineHeight: 1.7 }}
                >
                  {wotd.pashto}
                </div>

                {/* Romanization / first definition */}
                <span
                  className="font-display text-[28px] italic text-gold"
                  style={{ textShadow: '0 0 12px rgba(232,197,71,0.7), 0 0 30px rgba(232,197,71,0.35)' }}
                >
                  {wotd.definitions?.[0]?.text}
                </span>

                <span className="meta-label">{wotd.partOfSpeech || 'word'}</span>

                {/* Waveform listen button */}
                <button
                  onClick={() => setWotdPlaying((p) => !p)}
                  className="flex items-center gap-2 text-xs font-ui text-muted hover:text-warm transition-colors w-fit"
                >
                  <Waveform color="#e8c547" animated={wotdPlaying} />
                  <span>{wotdPlaying ? 'Playing…' : 'Listen'}</span>
                </button>
              </div>
            </>
          ) : (
            <p className="text-muted font-ui text-sm">No entries yet.</p>
          )}
        </div>

        {/* ── Search tile ── */}
        <div
          className="bento-card bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5 flex flex-col gap-4 bento-enter"
          style={{ gridColumn: 4, gridRow: 1, animationDelay: '0.15s' }}
        >
          <h2 className="text-sm font-semibold font-ui text-warm">Search</h2>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.08] rounded-[12px] py-2.5 pl-10 pr-10 text-warm text-[13px] font-ui outline-none focus:border-mint/50 transition-all"
                placeholder="Search Pashto words…"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-white/[0.06] border border-white/10 rounded px-1.5 py-0.5 text-[9px] text-muted font-semibold tracking-wide flex gap-1 font-ui pointer-events-none">
                <span>⌘</span><span>K</span>
              </div>
            </div>
            <button
              type="submit"
              className="shrink-0 px-3 py-2.5 bg-mint text-charcoal text-[12px] font-ui font-semibold rounded-[12px] hover:opacity-90 transition-opacity"
              style={{ boxShadow: '0 4px 20px rgba(0,245,180,0.3)' }}
            >
              Search
            </button>
          </form>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {['Nouns', 'Verbs', 'Phrases', 'A–Z'].map((f) => (
              <button
                key={f}
                onClick={() => navigate(`/entries?q=${encodeURIComponent(f.toLowerCase())}`)}
                className="px-2.5 py-1 text-[11px] font-ui text-muted border border-white/[0.08] rounded-full hover:border-mint/30 hover:text-warm transition-colors"
              >
                {f}
              </button>
            ))}
          </div>

          <Link
            to="/entries"
            className="text-[11px] font-ui text-mint hover:underline mt-auto"
          >
            Browse all entries →
          </Link>
        </div>

        {/* ── Stats tile ── */}
        <div
          className="bento-card bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5 flex flex-col gap-4 bento-enter"
          style={{ gridColumn: 4, gridRow: 2, animationDelay: '0.22s' }}
        >
          <h2 className="text-sm font-semibold font-ui text-warm">Stats</h2>
          <div className="flex flex-col gap-3">
            <Stat value={total} label="Words Published" color="#e8c547" />
            <div className="flex items-center gap-2">
              <AvatarStack />
              <span className="text-[11px] font-ui text-muted">Contributors</span>
            </div>
            <Stat value={addedThisMonth} label="Added This Month" color="#a78bfa" />
          </div>
        </div>

        {/* ── Word tiles ── */}
        {[0, 1, 2].map((i) => {
          const delays = ['0.28s', '0.36s', '0.44s'];
          const entry = wordTiles[i];
          return entry ? (
            <Link
              key={entry._id}
              to={`/entries/${entry._id}`}
              style={{ gridColumn: i + 1, gridRow: 3, textDecoration: 'none' }}
            >
              <WordTile entry={entry} delay={delays[i]} />
            </Link>
          ) : (
            <div
              key={`empty-${i}`}
              className="bg-white/[0.02] border border-white/[0.04] rounded-[20px] bento-enter"
              style={{ gridColumn: i + 1, gridRow: 3, animationDelay: delays[i] }}
            />
          );
        })}

        {/* ── CTA tile ── */}
        <div
          className="bento-card rounded-[20px] p-5 flex flex-col justify-between bento-enter"
          style={{
            gridColumn: 4,
            gridRow: 3,
            animationDelay: '0.42s',
            background: 'linear-gradient(135deg, rgba(0,245,180,0.10) 0%, rgba(232,197,71,0.06) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse-soft" />
            <span className="text-[11px] font-ui text-muted">Join contributors</span>
          </div>

          <p className="text-sm font-ui text-warm leading-snug">
            Help preserve the Pashto language — submit a word today.
          </p>

          <Link
            to={ctaTarget}
            className="block w-full text-center py-2.5 rounded-[10px] text-sm font-ui font-semibold text-charcoal bg-mint hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 4px 20px rgba(0,245,180,0.3)' }}
          >
            Contribute
          </Link>
        </div>
      </div>
    </div>
  );
}
