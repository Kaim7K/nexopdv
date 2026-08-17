import { Check, ShieldCheck } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const AUTH_BENEFITS = [
  'Dados sincronizados em tempo real',
  'Acesso controlado por perfil',
  'Suporte para sua operação',
];

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="auth-premium relative grid min-h-dvh place-items-center overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
      <div className="auth-backdrop pointer-events-none absolute inset-0" />
      <ThemeToggle className="absolute right-4 top-4 !text-muted-foreground hover:!bg-muted hover:!text-foreground" />

      <div className="auth-shell relative grid w-full max-w-5xl overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="auth-story hidden flex-col justify-between p-12 text-white lg:flex">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Operação protegida
            </span>
            <h2 className="mt-8 max-w-md text-3xl font-bold leading-[1.12] tracking-[-0.04em]">
              Gestão clara para decisões mais inteligentes.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-emerald-50/70">
              Caixa, estoque e financeiro conectados em uma experiência rápida,
              segura e feita para a rotina do seu mercado.
            </p>
          </div>
          <div className="grid gap-3 text-sm font-semibold text-emerald-50/80">
            {AUTH_BENEFITS.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-300/10 text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="auth-form-panel p-6 sm:p-10 lg:p-12">
          <div className="mb-7 flex flex-col items-center lg:items-start">
            <div className="mb-3 flex h-14 items-center justify-center sm:h-16">
              <img src="/brand/nexo-logo.svg" alt="Nexo PDV" width="220" height="83" className="h-12 w-auto max-w-[180px] sm:h-14 sm:max-w-[210px] dark:hidden" />
              <img src="/brand/nexo-logo-white.svg" alt="" width="220" height="83" className="hidden h-12 w-auto max-w-[180px] sm:h-14 sm:max-w-[210px] dark:block" />
            </div>
            {subtitle && (
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                {subtitle}
              </p>
            )}
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.035em] text-foreground sm:text-3xl">
              {title}
            </h1>
          </div>

          <section className="auth-card p-5 sm:p-7" aria-label="Acesso à conta">
            {children}
          </section>

          <p className="mt-6 text-center text-xs text-muted-foreground lg:text-left">
            © {new Date().getFullYear()} Nexo PDV
          </p>
        </div>
      </div>
    </main>
  );
}
