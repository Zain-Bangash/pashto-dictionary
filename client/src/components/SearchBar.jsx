import { useState } from 'react';

export default function SearchBar({ initialValue = '', onSubmit }) {
  const [query, setQuery] = useState(initialValue);

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(query.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Pashto words…"
        className="flex-1 border border-neutral-300 rounded-lg px-4 py-2 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400"
      />
      <button
        type="submit"
        className="px-6 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
