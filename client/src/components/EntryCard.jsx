import { Link } from 'react-router-dom';

export default function EntryCard({ entry }) {
  const firstDef = entry.definitions?.[0]?.text ?? '';
  const truncated = firstDef.length > 80 ? firstDef.slice(0, 80) + '…' : firstDef;

  return (
    <Link
      to={`/entries/${entry._id}`}
      className="bento-card mint-glow block bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5 no-underline"
    >
      <div dir="rtl" className="font-pashto text-warm text-2xl" style={{ lineHeight: 1.7 }}>
        {entry.pashto}
      </div>
      {entry.phonetic && (
        <p className="text-sm font-display italic text-gold mt-1">{entry.phonetic}</p>
      )}
      {entry.partOfSpeech && (
        <span className="meta-label">{entry.partOfSpeech}</span>
      )}
      {truncated && (
        <p className="text-sm font-ui text-muted mt-2 leading-snug">{truncated}</p>
      )}
    </Link>
  );
}
