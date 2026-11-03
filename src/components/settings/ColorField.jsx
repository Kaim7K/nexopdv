import { useEffect, useState } from 'react';
import { normalizeHex } from '@/lib/color-contrast';

export default function ColorField({ label, value, onChange }) {
  const normalized = normalizeHex(value, '#000000');
  const [draft, setDraft] = useState(normalized.toUpperCase());

  useEffect(() => {
    setDraft(normalized.toUpperCase());
  }, [normalized]);

  const commit = (candidate) => {
    const text = String(candidate || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(text) || /^#[0-9a-f]{3}$/i.test(text)) {
      const next = normalizeHex(text, normalized);
      setDraft(next.toUpperCase());
      onChange(next);
      return;
    }
    setDraft(normalized.toUpperCase());
  };

  return (
    <label className="text-sm font-semibold">
      {label}
      <span className="mt-1.5 flex h-11 overflow-hidden rounded-xl border border-border bg-background focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <input
          type="color"
          value={normalized}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next.toUpperCase());
            onChange(next);
          }}
          className="h-full w-14 cursor-pointer border-0 bg-transparent p-1"
          aria-label={label}
        />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value.toUpperCase())}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(event.currentTarget.value);
            }
          }}
          maxLength={7}
          className="min-w-0 flex-1 bg-transparent px-3 font-mono text-sm uppercase outline-none"
          aria-label={`${label} em hexadecimal`}
        />
      </span>
    </label>
  );
}

