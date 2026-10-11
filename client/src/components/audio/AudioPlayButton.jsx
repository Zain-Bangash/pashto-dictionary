import useClipPlayer from '../../hooks/useClipPlayer';

const BTN = 'inline-flex items-center justify-center w-8 h-8 rounded-full border text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const IDLE = 'bg-white/[0.05] border-white/[0.1] text-warm hover:border-terracotta/50 hover:text-terracotta';
const PLAYING = 'bg-terracotta/15 border-terracotta/50 text-terracotta';

export default function AudioPlayButton({ clip, label = 'Play recording', className = '' }) {
  const player = useClipPlayer(clip);

  if (!clip?.url) return null;
  if (!player.playable) {
    return (
      <span className={`text-[11px] font-ui text-muted/60 ${className}`} title={clip.mimeType}>
        Can&rsquo;t play on this device
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={player.toggle}
        aria-label={player.playing ? `Stop ${label.toLowerCase()}` : label}
        aria-pressed={player.playing}
        className={`${BTN} ${player.playing ? PLAYING : IDLE}`}
      >
        {player.playing ? '■' : '▶'}
      </button>
      {player.failed && <span className="text-[11px] font-ui text-red-400">Couldn&rsquo;t play. Reload the page and try again.</span>}
    </span>
  );
}
