const BARS = [
  [3, '[animation-delay:0s]'],
  [6, '[animation-delay:0.18s]'],
  [9, '[animation-delay:0.36s]'],
  [5, '[animation-delay:0.27s]'],
  [9, '[animation-delay:0.09s]'],
  [6, '[animation-delay:0.45s]'],
  [3, '[animation-delay:0.13s]'],
];

// Bars take the text colour of the parent
export default function Waveform({ animated = false, className = '' }) {
  return (
    <svg width="18" height="12" viewBox="0 0 22 16" aria-hidden="true" className={`shrink-0 ${className}`}>
      {BARS.map(([h, delay], i) => (
        <rect
          key={i}
          className={`${animated ? 'wave-active' : 'wave-idle'} origin-center ${delay}`}
          x={i * 3} y={(16 - h) / 2} width="2" height={h} rx="1"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
