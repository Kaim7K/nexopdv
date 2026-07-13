import React from 'react';

export default function ModuleSwitch({ module, checked, disabled = false, compact = false, onChange }) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 transition ${compact ? 'min-h-11 py-2' : 'min-h-[66px] py-3'} ${checked ? 'border-accent/35 bg-accent/10' : 'border-border bg-muted/15'} ${disabled ? 'pointer-events-none opacity-55' : 'hover:border-accent/35 hover:bg-muted/35'}`}>
      <span className="min-w-0">
        <strong className={`block text-xs ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{module.label}</strong>
        {!compact && <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{module.description}</span>}
      </span>
      <span className="relative h-6 w-11 shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={event => onChange(event.target.checked)}
          aria-label={`${checked ? 'Desativar' : 'Ativar'} ${module.label}`}
        />
        <span className="absolute inset-0 rounded-full bg-muted-foreground/30 transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2" />
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
