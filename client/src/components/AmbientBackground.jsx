// Faint diamond lattice, terracotta and gold glows and grain behind public pages
export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden="true">
      <div className="ambient-lattice absolute inset-0" />
      <div className="absolute rounded-full w-[65vw] h-[65vw] top-[-25%] left-[-20%] bg-[radial-gradient(circle,rgba(196,119,90,0.07)_0%,transparent_55%)]" />
      <div className="absolute rounded-full w-[55vw] h-[55vw] bottom-[-15%] right-[-15%] bg-[radial-gradient(circle,rgba(232,197,71,0.06)_0%,transparent_55%)]" />
      <div className="grain-overlay" />
    </div>
  );
}
