import { useState } from 'react';

export default function SearchBar({ initialValue = '', onSubmit }) {
  const [query, setQuery] = useState(initialValue);

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(query.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Pashto words…"
        className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-warm font-ui text-sm outline-none focus:border-terracotta/40 transition-colors placeholder:text-muted/60"
      />
      <button type="submit" className="sr-only">Search</button>
    </form>
  );
}
