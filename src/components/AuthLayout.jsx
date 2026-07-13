import React from "react";
import ThemeToggle from '@/components/ThemeToggle';

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.12),transparent_38%),radial-gradient(circle_at_bottom_left,hsl(var(--primary)/0.08),transparent_42%)]" />
      <ThemeToggle className="absolute right-4 top-4 !text-muted-foreground hover:!bg-muted hover:!text-foreground" />
      <div className="relative w-full max-w-md">
        <div className="mb-7 flex flex-col items-center">
          <div className="mb-4 flex h-20 items-center justify-center">
            <img src="/brand/nexo-logo.svg" alt="Nexo PDV" width="220" height="83" fetchPriority="high" className="h-16 w-auto max-w-[220px] dark:hidden" />
            <img src="/brand/nexo-logo-white.svg" alt="" width="220" height="83" fetchPriority="high" className="hidden h-16 w-auto max-w-[220px] dark:block" />
          </div>
          {subtitle && <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">{subtitle}</p>}
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        </div>

        <section className="rounded-3xl border border-border bg-card/95 p-5 shadow-xl shadow-black/5 backdrop-blur sm:p-7" aria-label="Acesso à conta">
          {children}
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nexo PDV
        </p>
      </div>
    </main>
  );
}
