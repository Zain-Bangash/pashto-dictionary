import { useState, useRef, useEffect } from 'react';

function playable(mimeType) {
  if (typeof document === 'undefined') return true;
  const probe = document.createElement('audio');
  return typeof probe.canPlayType !== 'function' || probe.canPlayType(mimeType) !== '';
}

const BTN = 'inline-flex items-center justify-center w-8 h-8 rounded-full border text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

export default function AudioPlayButton({ clip, label = 'Play recording', className = '' }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed]   = useState(false);

  useEffect(() => () => audioRef.current?.pause(), []);

  if (!clip?.url) return null;
  if (!playable(clip.mimeType)) {
    return (
      <span className={`text-[11px] font-ui text-muted/60 ${className}`} title={clip.mimeType}>
        Can&rsquo;t play on this device
      </span>
    );
  }

  const toggle = () => {
    if (!audioRef.current) {
      const audio = new Audio(clip.url);
      audio.onended = () => setPlaying(false);
      audio.onerror = () => { setPlaying(false); setFailed(true); };
      audioRef.current = audio;
    }
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }
    setFailed(false);
    const started = audioRef.current.play();
    setPlaying(true);
    started?.catch?.(() => { setPlaying(false); setFailed(true); });
  };

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Stop ${label.toLowerCase()}` : label}
        aria-pressed={playing}
        className={`${BTN} ${playing ? 'bg-mint/20 border-mint/50 text-mint' : 'bg-white/[0.05] border-white/[0.1] text-warm hover:border-mint/40 hover:text-mint'}`}
      >
        {playing ? '■' : '▶'}
      </button>
      {failed && <span className="text-[11px] font-ui text-red-400">Couldn&rsquo;t play. Reload the page and try again.</span>}
    </span>
  );
}
