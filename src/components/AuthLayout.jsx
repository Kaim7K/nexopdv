import React from 'react';
import ThemeToggle from '@/components/ThemeToggle';

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--muted)/0.65),transparent_42%),linear-gradient(180deg,transparent,hsl(var(--accent)/0.08))]" />
      <ThemeToggle className="absolute right-4 top-4 !text-muted-foreground hover:!bg-muted hover:!text-foreground" />
      <div className="relative w-full max-w-md">
        <div className="mb-7 flex flex-col items-center">
          <div className="mb-4 flex h-20 items-center justify-center">
            <img src="/brand/nexo-logo.svg" alt="Nexo PDV" width="220" height="83" fetchPriority="high" className="h-16 w-auto max-w-[220px] dark:hidden" />
            <img src="/brand/nexo-logo-white.svg" alt="" width="220" height="83" fetchPriority="high" className="hidden h-16 w-auto max-w-[220px] dark:block" />
          </div>
          {subtitle && <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">{subtitle}</p>}
          <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        </div>

        <section className="rounded-lg border border-border/80 bg-card/95 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-7" aria-label="Acesso à conta">
          {children}
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nexo PDV
        </p>
      </div>
    </main>
  );
}
