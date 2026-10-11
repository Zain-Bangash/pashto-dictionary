export default function SelectBox({ checked, onChange, label, disabled = false }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      disabled={disabled}
      aria-label={label}
      className="mt-1 h-4 w-4 shrink-0 accent-terracotta cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
    />
  );
}
