import useClipPlayer from '../../hooks/useClipPlayer';
import Waveform from './Waveform';

// The terracotta "Listen" pill; renders nothing without a published clip this device can play
export default function ListenButton({ clip, label = 'Listen', className = '' }) {
  const player = useClipPlayer(clip);
  if (!clip?.url || !player.playable) return null;

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    player.toggle();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={player.playing ? `Stop ${label.toLowerCase()}` : label}
      aria-pressed={player.playing}
      title={player.failed ? 'Couldn’t play. Reload the page and try again.' : undefined}
      className={`listen-btn inline-flex items-center gap-1.5 border border-terracotta/35 rounded-full text-terracotta hover:bg-terracotta/10 px-3 py-1.5 transition-colors ${className}`}
    >
      <Waveform animated={player.playing} />
      <span className="font-ui text-xs">{player.playing ? 'Playing…' : 'Listen'}</span>
    </button>
  );
}
