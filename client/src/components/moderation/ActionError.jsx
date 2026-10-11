export default function ActionError({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 flex items-start gap-3 bg-red-400/[0.06] border border-red-400/30 rounded-[12px] px-4 py-2.5 text-sm font-ui text-red-400">
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="hover:text-red-300 transition-colors">×</button>
    </div>
  );
}
