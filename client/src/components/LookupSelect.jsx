import useLookups from '../hooks/useLookups';

export default function LookupSelect({ type, value, onChange, placeholder, className, optionClassName, ...rest }) {
  const { active, find, loading, error, reload } = useLookups();
  const options = active(type);
  const current = value ? find(type, value) : null;
  const retired = value && !options.some((o) => o.key === value);

  return (
    <>
      <select
        value={value}
        onChange={onChange}
        disabled={loading || !!error}
        className={className}
        {...rest}
      >
        {loading ? (
          <option value={value} className={optionClassName}>Loading…</option>
        ) : (
          <>
            {placeholder !== undefined && <option value="" className={optionClassName}>{placeholder}</option>}
            {options.map((o) => (
              <option key={o.key} value={o.key} className={optionClassName}>{o.label}</option>
            ))}
            {retired && (
              <option value={value} className={optionClassName}>{current?.label ?? value} (retired)</option>
            )}
          </>
        )}
      </select>
      {error && (
        <p role="alert" className="text-red-400 text-xs font-ui mt-1">
          {error}.{' '}
          <button type="button" onClick={reload} className="underline hover:text-red-300">Retry</button>
        </p>
      )}
    </>
  );
}
