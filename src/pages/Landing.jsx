import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  CirclePlay,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LockKeyhole,
  ScanBarcode,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Upload,
  UserRoundCog,
  UsersRound,
  WalletCards,
  Zap,
} from 'lucide-react';
import { usePageMetadata } from '@/hooks/use-page-metadata';

const QUICK_BENEFITS = [
  {
    title: 'Venda mais rápido',
    text: 'Busca, atalhos e leitor de código.',
    Icon: Zap,
  },
  {
    title: 'Controle o estoque',
    text: 'Edite, filtre e importe em massa.',
    Icon: Boxes,
  },
  {
    title: 'Gerencie fiados',
    text: 'Responsáveis e recebimentos organizados.',
    Icon: UsersRound,
  },
  {
    title: 'Acompanhe resultados',
    text: 'Relatórios claros para decidir melhor.',
    Icon: BarChart3,
  },
];

const FAQS = [
  {
    question: 'Preciso instalar algum programa?',
    answer: 'Não. O Nexo PDV funciona pelo navegador em dispositivos compatíveis.',
  },
  {
    question: 'Posso manter várias vendas abertas?',
    answer: 'Sim. Minimize uma venda, atenda outro cliente e retome quando quiser.',
  },
  {
    question: 'Posso importar produtos por planilha?',
    answer: 'Sim. Você pode importar arquivos compatíveis e atualizar vários produtos de uma vez.',
  },
];

function Logo({ light = false }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="Nexo PDV">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-lg font-black text-white shadow-sm">
        N
      </div>
      <div className={`text-xl font-black tracking-tight ${light ? 'text-white' : 'text-slate-950'}`}>
        Nexo <span className="text-emerald-600">PDV</span>
      </div>
    </div>
  );
}

function PrimaryCta({ href, children, dark = false, className = '' }) {
  return (
    <a
      href={href}
      target={href.startsWith('https://') ? '_blank' : undefined}
      rel={href.startsWith('https://') ? 'noreferrer' : undefined}
      className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold transition duration-300 ${
        dark
          ? 'bg-white text-emerald-900 shadow-lg shadow-black/10 hover:-translate-y-0.5 hover:bg-emerald-50'
          : 'bg-emerald-600 text-white shadow-lg shadow-emerald-700/20 hover:-translate-y-0.5 hover:bg-emerald-700'
      } ${className}`}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </a>
  );
}

function SecondaryCta({ href, children, dark = false }) {
  return (
    <a
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-extrabold transition duration-300 hover:-translate-y-0.5 ${
        dark
          ? 'border-white/25 bg-white/5 text-white hover:bg-white/10'
          : 'border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50/50'
      }`}
    >
      {children}
    </a>
  );
}

function ProductFrame({ src, alt, eager = false, className = '' }) {
  return (
    <div
      className={`overflow-hidden rounded-[1.6rem] border border-slate-800/10 bg-slate-950 p-2.5 shadow-[0_28px_90px_-38px_rgba(15,23,42,0.55)] ${className}`}
    >
      <div className="mb-2 flex h-6 items-center gap-1.5 px-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <div className="ml-3 h-2 w-28 rounded-full bg-white/10" />
      </div>
      <div className="overflow-hidden rounded-[1.1rem] bg-[#eef3f0]">
        <img
          src={src}
          alt={alt}
          width="1700"
          height="980"
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          className="block h-auto w-full"
        />
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-emerald-800">
      {children}
    </span>
  );
}

function Bullet({ children }) {
  return (
    <li className="flex items-start gap-2.5 text-sm font-semibold leading-6 text-slate-600 sm:text-[15px]">
      <span className="mt-1 grid h-5 w-5 flex-none place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <span>{children}</span>
    </li>
  );
}

function QuickBenefit({ title, text, Icon }) {
  return (
    <article className="group flex min-h-[132px] items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5">
      <div className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h3 className="font-black text-slate-950">{title}</h3>
        <p className="mt-1.5 text-sm leading-5 text-slate-500">{text}</p>
      </div>
    </article>
  );
}

function RoleCard({ iconClass, iconBg, title, description }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${iconBg}`}>
        <UserRoundCog className={`h-[18px] w-[18px] ${iconClass}`} />
      </div>
      <div>
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
    </div>
  );
}

function FeatureStat({ value, label }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xl font-black text-slate-950">{value}</div>
      <div className="mt-0.5 text-xs font-semibold text-slate-500">{label}</div>
    </div>
  );
}

export default function Landing() {
  const structuredData = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Nexo PDV',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'Sistema de caixa, estoque, fiados e relatórios para mercadinhos e mercados de bairro.',
    offers: { '@type': 'Offer', availability: 'https://schema.org/InStock' },
    publisher: { '@type': 'Organization', name: 'Nexo PDV' },
  }), []);
  usePageMetadata({
    title: 'Nexo PDV | Sistema de Caixa e Estoque para Mercadinhos',
    description: 'Venda com mais agilidade, controle o estoque, acompanhe fiados e veja relatórios do seu mercado em um só sistema.',
    robots: 'index, follow, max-image-preview:large',
    canonicalPath: '/',
    imagePath: '/nexo-pdv-og.png',
    structuredData,
  });
  const whatsapp = String(import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const message = encodeURIComponent('Olá! Quero conhecer o Nexo PDV para o meu mercado.');
  const contactHref = whatsapp ? `https://wa.me/${whatsapp}?text=${message}` : '#demonstracao';

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7faf8] text-slate-950 selection:bg-emerald-200">
      <header className="sticky top-0 z-50 border-b border-white/70 bg-[#f7faf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#inicio" aria-label="Ir para o início">
            <Logo />
          </a>

          <nav className="hidden items-center gap-8 text-sm font-bold text-slate-600 md:flex" aria-label="Navegação principal">
            <a className="transition hover:text-emerald-700" href="#recursos">Recursos</a>
            <a className="transition hover:text-emerald-700" href="#demonstracao">Como funciona</a>
            <a className="transition hover:text-emerald-700" href="#faq">FAQ</a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              to="/login"
              className="hidden min-h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50 sm:inline-flex"
            >
              Entrar
            </Link>
            <a
              href={contactHref}
              target={contactHref.startsWith('https://') ? '_blank' : undefined}
              rel={contactHref.startsWith('https://') ? 'noreferrer' : undefined}
              className="inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white shadow-md shadow-emerald-700/15 transition hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              Quero conhecer
            </a>
          </div>
        </div>
      </header>

      <main>
        <section id="inicio" className="relative isolate overflow-hidden pt-14 sm:pt-20 lg:pt-24">
          <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_82%_18%,rgba(16,185,129,0.15),transparent_28%),radial-gradient(circle_at_12%_12%,rgba(110,231,183,0.13),transparent_22%)]" />
          <div className="absolute inset-0 -z-10 opacity-[0.16] [background-image:radial-gradient(#10b981_1px,transparent_1px)] [background-size:26px_26px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />

          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 sm:px-6 lg:grid-cols-[0.84fr_1.16fr] lg:px-8 lg:pb-24">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-black text-emerald-800 shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Sistema completo para mercadinhos
              </div>

              <h1 className="mt-5 text-[2.65rem] font-black leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.65rem]">
                O PDV inteligente para mercadinhos{' '}
                <span className="text-emerald-600">rápidos, organizados e no controle.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base font-medium leading-7 text-slate-600 sm:text-lg">
                Mais agilidade no caixa, estoque organizado, fiados sob controle e relatórios que ajudam a decidir.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <PrimaryCta href={contactHref}>Quero conhecer</PrimaryCta>
                <SecondaryCta href="#demonstracao">
                  <CirclePlay className="h-4 w-4" />
                  Ver demonstração
                </SecondaryCta>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {[
                  [ShoppingCart, 'PDV rápido'],
                  [WalletCards, 'Fiados sob controle'],
                  [FileSpreadsheet, 'Estoque inteligente'],
                ].map(([Icon, label]) => (
                  <span key={label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 shadow-sm">
                    <Icon className="h-3.5 w-3.5 text-emerald-600" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[780px] lg:-mr-16">
              <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-emerald-300/20 blur-3xl" />
              <ProductFrame
                src="/landing/pdv-preview.png"
                alt="Tela real do Nexo PDV com produtos, venda atual e vendas abertas"
                eager
                className="rotate-[0.35deg]"
              />

              <div className="absolute -bottom-5 right-4 hidden min-w-[205px] rounded-2xl border border-emerald-950/20 bg-[#0f2a21] p-4 text-white shadow-2xl shadow-emerald-950/30 sm:block lg:-right-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
                    <LayoutDashboard className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-black leading-none">3</div>
                    <div className="mt-1 text-xs font-bold text-emerald-100">vendas abertas</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-3 rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-3 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_BENEFITS.map(item => <QuickBenefit key={item.title} {...item} />)}
          </div>
        </section>

        <section id="demonstracao" className="relative py-16 sm:py-20 lg:py-28">
          <div className="absolute inset-y-0 left-0 -z-10 w-full bg-white/70" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.62fr_1.38fr] lg:px-8">
            <div className="max-w-md">
              <SectionLabel>Caixa rápido</SectionLabel>
              <h2 className="mt-4 text-4xl font-black leading-[1.04] tracking-[-0.04em] sm:text-5xl">
                Mais agilidade no caixa
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Menos etapas para vender. Mais fluidez para atender.
              </p>
              <ul className="mt-6 space-y-3">
                <Bullet>Leitor de código de barras</Bullet>
                <Bullet>Pagamento misto e desconto</Bullet>
                <Bullet>Vendas simultâneas abertas</Bullet>
              </ul>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-emerald-200/35 blur-3xl" />
              <ProductFrame
                src="/landing/pdv-preview.png"
                alt="Frente de caixa do Nexo PDV"
              />
              <div className="absolute -right-2 bottom-7 hidden w-[170px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl lg:block">
                <div className="flex items-center justify-between">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                    <ShoppingCart className="h-[18px] w-[18px]" />
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </div>
                <div className="mt-5 text-4xl font-black text-slate-950">3</div>
                <div className="mt-1 text-xs font-bold text-slate-500">vendas em andamento</div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-16 sm:py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.35fr_0.65fr] lg:px-8">
            <div className="relative order-2 lg:order-1">
              <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-emerald-200/30 blur-3xl" />
              <ProductFrame
                src="/landing/estoque-preview.png"
                alt="Estoque do Nexo PDV em formato de planilha"
              />
              <div className="absolute -bottom-5 left-5 hidden gap-2 sm:flex">
                <FeatureStat value="1.284" label="produtos ativos" />
                <FeatureStat value="8" label="alterações salvas" />
              </div>
            </div>

            <div className="order-1 max-w-md lg:order-2 lg:justify-self-end">
              <SectionLabel>Estoque inteligente</SectionLabel>
              <h2 className="mt-4 text-4xl font-black leading-[1.04] tracking-[-0.04em] sm:text-5xl">
                Estoque em modo planilha
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Atualize muitos produtos sem perder tempo.
              </p>
              <ul className="mt-6 space-y-3">
                <Bullet>Edite diretamente na tabela</Bullet>
                <Bullet>Importe e exporte planilhas</Bullet>
                <Bullet>Filtre por produto, preço e estoque</Bullet>
              </ul>
              <div className="mt-7 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
                  <Upload className="h-4 w-4 text-emerald-600" /> Importação em massa
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
                  <ScanBarcode className="h-4 w-4 text-emerald-600" /> Códigos de barras
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="relative bg-white/70 py-16 sm:py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.62fr_1.38fr] lg:px-8">
            <div className="max-w-md">
              <SectionLabel>Relatórios</SectionLabel>
              <h2 className="mt-4 text-4xl font-black leading-[1.04] tracking-[-0.04em] sm:text-5xl">
                Relatórios que ajudam a decidir
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Veja o que vende, como recebe e onde agir.
              </p>
              <ul className="mt-6 space-y-3">
                <Bullet>Faturamento e ticket médio</Bullet>
                <Bullet>Produtos e vendedores em destaque</Bullet>
                <Bullet>Pagamentos, cancelamentos e fiados</Bullet>
              </ul>
              <div className="mt-7 grid grid-cols-3 gap-2">
                <FeatureStat value="R$" label="faturamento" />
                <FeatureStat value="↑" label="desempenho" />
                <FeatureStat value="Top 5" label="produtos" />
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-emerald-200/30 blur-3xl" />
              <ProductFrame
                src="/landing/relatorios-preview.png"
                alt="Relatórios gerenciais do Nexo PDV"
              />
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <ShieldCheck className="h-[22px] w-[22px]" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black">Equipe e permissões</h3>
                      <p className="mt-1 text-sm text-slate-500">Cada função acessa o que precisa.</p>
                    </div>
                  </div>
                </div>
                <LockKeyhole className="h-5 w-5 text-slate-300" />
              </div>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
                <RoleCard iconBg="bg-emerald-100" iconClass="text-emerald-700" title="Gerente" description="Acesso amplo" />
                <RoleCard iconBg="bg-blue-100" iconClass="text-blue-700" title="Caixa" description="PDV e vendas" />
                <RoleCard iconBg="bg-violet-100" iconClass="text-violet-700" title="Estoque" description="Produtos e custos" />
              </div>
            </article>

            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <History className="h-[22px] w-[22px]" />
                </div>
                <div>
                  <h3 className="text-xl font-black">Histórico de atividades</h3>
                  <p className="mt-1 text-sm text-slate-500">Mais clareza sobre cada alteração.</p>
                </div>
              </div>
              <div className="mt-6 space-y-2.5">
                {[
                  ['Preço do Arroz tipo 1 alterado', 'Hoje, 10:24'],
                  ['Venda #1287 finalizada', 'Hoje, 10:18'],
                  ['Planilha de estoque importada', 'Hoje, 09:42'],
                ].map(([label, time]) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
                    <Activity className="h-4 w-4 flex-none text-emerald-600" />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{label}</span>
                    <span className="text-xs font-medium text-slate-400">{time}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section id="faq" className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <SectionLabel>FAQ</SectionLabel>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] sm:text-4xl">Dúvidas frequentes</h2>
            </div>
            <div className="mt-8 grid gap-3 lg:grid-cols-3">
              {FAQS.map(item => (
                <details key={item.question} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm open:border-emerald-200 open:shadow-lg open:shadow-emerald-900/5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-extrabold text-slate-900">
                    <span>{item.question}</span>
                    <ChevronDown className="h-4 w-4 flex-none text-slate-400 transition group-open:rotate-180 group-open:text-emerald-600" />
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contato" className="px-4 pb-8 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#0c3a2a] px-6 py-10 text-white shadow-2xl shadow-emerald-950/20 sm:px-10 sm:py-12 lg:px-14">
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(#6ee7b7_1px,transparent_1px)] [background-size:30px_30px] [mask-image:linear-gradient(to_right,black,transparent_70%)]" />
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />

            <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div className="flex items-start gap-5">
                <div className="hidden sm:block">
                  <Logo light />
                </div>
                <div>
                  <h2 className="max-w-2xl text-3xl font-black leading-[1.05] tracking-[-0.035em] sm:text-4xl">
                    Seu mercado pode vender melhor com o <span className="text-emerald-300">Nexo PDV.</span>
                  </h2>
                  <p className="mt-3 text-sm font-medium text-emerald-50/75 sm:text-base">
                    Caixa, estoque, fiados, equipe e relatórios em um só sistema.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 lg:justify-end">
                <PrimaryCta href={contactHref} dark>Quero conhecer</PrimaryCta>
                <SecondaryCta href="#demonstracao" dark>
                  <CirclePlay className="h-4 w-4" />
                  Ver demonstração
                </SecondaryCta>
              </div>
            </div>

            <div className="relative z-10 mt-9 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [ShoppingCart, 'Frente de caixa ágil'],
                [FileSpreadsheet, 'Importação de estoque'],
                [ShieldCheck, 'Perfis de acesso'],
                [BarChart3, 'Relatórios integrados'],
              ].map(([Icon, label]) => (
                <div key={label} className="flex items-center gap-2.5 text-sm font-bold text-emerald-50/85">
                  <Icon className="h-4 w-4 text-emerald-300" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-center text-sm text-slate-500 sm:px-6 md:flex-row md:text-left lg:px-8">
        <Logo />
        <p>© {new Date().getFullYear()} Nexo PDV. Sistema de gestão para mercados de bairro.</p>
      </footer>
    </div>
  );
}
