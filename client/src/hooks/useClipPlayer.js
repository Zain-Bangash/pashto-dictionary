import { useState, useRef, useEffect } from 'react';

function canPlay(mimeType) {
  if (!mimeType || typeof document === 'undefined') return true;
  const probe = document.createElement('audio');
  return typeof probe.canPlayType !== 'function' || probe.canPlayType(mimeType) !== '';
}

// Plays one signed clip; `playable` is false when this device cannot decode its format (e.g. WebM on older iPhones)
export default function useClipPlayer(clip) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed]   = useState(false);

  useEffect(() => () => audioRef.current?.pause(), []);

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

  return { playing, failed, toggle, playable: canPlay(clip?.mimeType) };
}
