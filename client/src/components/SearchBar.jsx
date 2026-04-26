import { useState } from 'react';

export default function SearchBar({ initialValue = '', onSubmit }) {
  const [query, setQuery] = useState(initialValue);

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(query.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full">
      <div className="relative flex-1">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Pashto words…"
          className="w-full bg-black/40 border border-white/[0.08] rounded-[12px] py-2.5 pl-10 pr-4 text-warm text-sm font-ui outline-none focus:border-mint/50 transition-all placeholder:text-muted"
        />
      </div>
      <button
        type="submit"
        className="px-5 py-2.5 bg-mint text-charcoal text-sm font-ui font-semibold rounded-[12px] hover:opacity-90 transition-opacity shrink-0"
        style={{ boxShadow: '0 4px 20px rgba(0,245,180,0.3)' }}
      >
        Search
      </button>
    </form>
  );
}
