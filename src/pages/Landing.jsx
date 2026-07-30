import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  ClipboardList,
  Cloud,
  DatabaseBackup,
  Headphones,
  LineChart,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tag,
  UsersRound,
  WalletCards,
  Zap,
} from 'lucide-react';
import { usePageMetadata } from '@/hooks/use-page-metadata';

const APP_IMAGES = {
  pdv: '/landing/pdv-preview.png',
  stock: '/landing/estoque-preview.png',
  reports: '/landing/relatorios-preview.png',
};

const HERO_BADGES = [
  { label: 'Sem instalação', Icon: Cloud },
  { label: 'Atualizações automáticas', Icon: DatabaseBackup },
  { label: 'Suporte humanizado', Icon: Headphones },
  { label: '100% na nuvem', Icon: ShieldCheck },
];


const FEATURE_CARDS = [
  {
    title: 'PDV rápido e intuitivo',
    text: 'Venda com poucos cliques, leitor de código e pagamento misto.',
    Icon: Zap,
  },
  {
    title: 'Estoque inteligente',
    text: 'Controle entradas, saídas, preços e alertas em tempo real.',
    Icon: Boxes,
  },
  {
    title: 'Produtos organizados',
    text: 'Cadastre, categorize e encontre qualquer item rapidamente.',
    Icon: Tag,
  },
  {
    title: 'Clientes fiéis',
    text: 'Histórico de compras, fiados e recebimentos em um só lugar.',
    Icon: UsersRound,
  },
  {
    title: 'Relatórios claros',
    text: 'Indicadores simples para decidir melhor todos os dias.',
    Icon: LineChart,
  },
  {
    title: 'Contas a pagar e receber',
    text: 'Acompanhe despesas, receitas, compras e vencimentos.',
    Icon: WalletCards,
  },
  {
    title: 'Permissões de acesso',
    text: 'Cada função no lugar certo, com histórico de alterações.',
    Icon: LockKeyhole,
  },
  {
    title: 'Backup e segurança',
    text: 'Dados protegidos para sua operação continuar funcionando.',
    Icon: ShieldCheck,
  },
];

const METRICS = [
  ['+5.000', 'mercadinhos gerenciados', ShoppingCart],
  ['+20 milhões', 'em vendas processadas', Tag],
  ['+99%', 'de uptime e estabilidade', BarChart3],
  ['Suporte', 'de verdade, quando precisar', Headphones],
];

const SHOWCASES = [
  {
    eyebrow: 'Atendimento que flui',
    title: 'Venda com agilidade e sem travar filas',
    text: 'A rotina do caixa fica direta: busque produtos, aplique descontos, escolha pagamentos e finalize sem trocar de tela.',
    image: APP_IMAGES.pdv,
    alt: 'Tela do PDV do Nexo com busca de produtos, carrinho e resumo da venda',
    bullets: [
      'Leitor de código de barras',
      'Venda minimizada',
      'Atalhos de teclado',
      'Diversas formas de pagamento',
    ],
  },
  {
    eyebrow: 'Informação que gera resultado',
    title: 'Relatórios completos para decisões melhores',
    text: 'Veja faturamento, ticket médio, formas de pagamento e produtos que mais vendem sem depender de planilhas soltas.',
    image: APP_IMAGES.reports,
    alt: 'Tela de relatórios do Nexo com indicadores, gráficos e rankings',
    bullets: [
      'Gráficos de vendas e desempenho',
      'Análise de lucro por produto',
      'Metas e comparativos',
      'Exportação em Excel e PDF',
    ],
    reverse: true,
  },
  {
    eyebrow: 'Estoque sob controle',
    title: 'Produtos, preços e quantidades sempre visíveis',
    text: 'Edite direto na tabela, importe planilhas, acompanhe alertas e evite perder vendas por falta de produto.',
    image: APP_IMAGES.stock,
    alt: 'Tela de estoque do Nexo com tabela de produtos, preços e quantidades',
    bullets: [
      'Importação por planilha',
      'Edição rápida em linha',
      'Produtos sem estoque',
      'Cadastro completo por item',
    ],
  },
];

const PLANS = [
  {
    name: 'Essencial',
    price: 'R$ 79',
    caption: '/mês',
    text: 'Ideal para quem está começando.',
    features: ['1 usuário', 'Até 2 caixas', 'Cadastros básicos', 'Relatórios básicos'],
  },
  {
    name: 'Profissional',
    price: 'R$ 129',
    caption: '/mês',
    text: 'Ideal para quem quer crescer com controle.',
    features: ['Até 5 usuários', 'Estoque e financeiro', 'Relatórios avançados', 'Metas e indicadores'],
    featured: true,
  },
  {
    name: 'Gestão',
    price: 'R$ 229',
    caption: '/mês',
    text: 'Para mercados que querem mais.',
    features: ['Usuários ilimitados', 'Múltiplas unidades', 'Integrações e API', 'Suporte dedicado'],
  },
];

const FAQS = [
  {
    question: 'Preciso instalar o sistema?',
    answer:
      'Não. O Nexo PDV funciona pelo navegador, com acesso seguro pela internet.',
  },
  {
    question: 'Funciona offline?',
    answer:
      'O sistema foi pensado para operação web. Se sua operação precisa de contingência offline, fale com a equipe para avaliar o melhor fluxo.',
  },
  {
    question: 'Meus dados estão seguros?',
    answer:
      'Sim. O sistema usa controle de acesso, permissões por perfil e rotinas de proteção dos dados da operação.',
  },
  {
    question: 'Posso usar em mais de um caixa?',
    answer:
      'Sim. Os planos permitem trabalhar com equipe e caixas conforme o tamanho da operação.',
  },
];

function getWhatsAppHref() {
  const whatsapp = String(import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(
    /\D/g,
    '',
  );
  const message = encodeURIComponent(
    'Olá! Quero conhecer o Nexo PDV para o meu mercado.',
  );
  return whatsapp ? `https://wa.me/${whatsapp}?text=${message}` : '#planos';
}

function Logo({ light = false, className = '' }) {
  return (
    <img
      src={light ? '/brand/nexo-logo-white.svg' : '/brand/nexo-logo.svg'}
      alt="Nexo PDV"
      width="130"
      height="52"
      className={`h-9 w-auto ${className}`}
    />
  );
}

function ExternalAnchor({ href, children, ...props }) {
  const external = href.startsWith('https://');
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      {...props}
    >
      {children}
    </a>
  );
}

function CtaButton({ href, children, variant = 'primary', className = '' }) {
  const variants = {
    primary:
      'bg-[#18c987] text-[#041b14] shadow-[0_18px_45px_rgba(24,201,135,0.28)] hover:bg-[#38e3a3]',
    dark:
      'border border-white/20 bg-white/10 text-white hover:bg-white/15',
    light:
      'border border-slate-200 bg-white text-slate-950 shadow-sm hover:border-[#18c987] hover:bg-emerald-50',
  };

  return (
    <ExternalAnchor
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-bold transition duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18c987] active:translate-y-0 ${variants[variant]} ${className}`}
    >
      {children}
    </ExternalAnchor>
  );
}

function SectionHeader({ eyebrow, title, text, light = false }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
          light
            ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200'
            : 'border-emerald-200 bg-emerald-50 text-[#0c8f60]'
        }`}
      >
        <Check className="h-3.5 w-3.5" />
        {eyebrow}
      </span>
      <h2
        className={`mt-3 text-balance text-2xl font-black leading-tight sm:text-4xl ${
          light ? 'text-white' : 'text-slate-950'
        }`}
      >
        {title}
      </h2>
      <p
        className={`mx-auto mt-3 max-w-2xl text-sm leading-6 sm:text-base ${
          light ? 'text-emerald-50/75' : 'text-slate-600'
        }`}
      >
        {text}
      </p>
    </div>
  );
}

function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-3xl lg:max-w-none">
      <div className="absolute -inset-4 rounded-[2rem] bg-emerald-300/10 blur-2xl" />
      <figure className="relative rotate-[-2deg] rounded-[1.6rem] border border-white/25 bg-slate-950/70 p-3 shadow-[0_42px_90px_rgba(0,0,0,0.5)] backdrop-blur">
        <div className="overflow-hidden rounded-[1.1rem] bg-white">
          <img
            src={APP_IMAGES.reports}
            alt="Painel do Nexo PDV com resumo do dia, gráficos, vendas e indicadores"
            width="1700"
            height="980"
            loading="eager"
            decoding="sync"
            className="aspect-[16/10] w-full object-cover object-top"
          />
        </div>
      </figure>
      <div className="absolute -bottom-6 right-4 hidden w-48 rounded-xl border border-emerald-300/30 bg-[#06241b]/95 p-4 text-white shadow-2xl backdrop-blur sm:block">
        <span className="text-xs font-bold text-emerald-200">Venda concluída</span>
        <strong className="mt-1 block text-2xl font-black text-emerald-300">
          R$ 68,40
        </strong>
        <p className="mt-1 text-xs text-emerald-50/70">em segundos</p>
      </div>
    </div>
  );
}

function FeatureCard({ Icon, title, text }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_50px_rgba(15,23,42,0.09)]">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-50 text-[#0c9b68] ring-1 ring-emerald-100">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-black text-slate-950">{title}</h3>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">{text}</p>
        </div>
      </div>
    </article>
  );
}

function MetricStrip() {
  return (
    <div className="grid overflow-hidden rounded-xl bg-[#06241b] text-white shadow-[0_24px_70px_rgba(6,36,27,0.22)] md:grid-cols-4">
      {METRICS.map(([value, label, Icon]) => (
        <div
          key={value}
          className="flex items-center gap-4 border-b border-white/10 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
        >
          <Icon className="h-8 w-8 shrink-0 text-[#18c987]" />
          <div>
            <strong className="block text-lg font-black">{value}</strong>
            <span className="text-sm leading-5 text-emerald-50/80">{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Showcase({ item }) {
  return (
    <article
      className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${
        item.reverse ? 'lg:[&>figure]:order-first' : ''
      }`}
    >
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#0c8f60]">
          <Check className="h-3.5 w-3.5" />
          {item.eyebrow}
        </span>
        <h3 className="mt-4 text-balance text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
          {item.title}
        </h3>
        <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
          {item.text}
        </p>
        <ul className="mt-5 grid gap-2">
          {item.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700"
            >
              <Check className="h-4 w-4 text-[#10a46d]" />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
      <figure className="rounded-xl border border-slate-200 bg-white p-2 shadow-[0_24px_70px_rgba(15,23,42,0.09)]">
        <img
          src={item.image}
          alt={item.alt}
          width="1700"
          height="980"
          loading="lazy"
          decoding="async"
          className="aspect-[16/9] w-full rounded-lg object-cover object-top"
        />
      </figure>
    </article>
  );
}

function PlanCard({ plan, contactHref }) {
  return (
    <article
      className={`relative flex min-h-full flex-col rounded-xl border p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)] ${
        plan.featured
          ? 'border-emerald-300 bg-[#06241b] text-white'
          : 'border-slate-200 bg-white text-slate-950'
      }`}
    >
      {plan.featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#18c987] px-4 py-1 text-xs font-black uppercase text-[#06241b]">
          Mais escolhido
        </span>
      )}
      <h3 className="text-xl font-black">{plan.name}</h3>
      <div className="mt-4 flex items-end gap-1">
        <strong className="text-3xl font-black">{plan.price}</strong>
        <span
          className={`pb-1 text-sm ${
            plan.featured ? 'text-emerald-50/75' : 'text-slate-500'
          }`}
        >
          {plan.caption}
        </span>
      </div>
      <p
        className={`mt-3 text-sm leading-6 ${
          plan.featured ? 'text-emerald-50/75' : 'text-slate-600'
        }`}
      >
        {plan.text}
      </p>
      <ul className="mt-5 grid gap-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm font-semibold">
            <Check className="h-4 w-4 text-[#18c987]" />
            {feature}
          </li>
        ))}
      </ul>
      <CtaButton
        href={contactHref}
        variant={plan.featured ? 'primary' : 'light'}
        className="mt-6 w-full"
      >
        Começar agora
      </CtaButton>
    </article>
  );
}

export default function Landing() {
  const contactHref = getWhatsAppHref();

  const structuredData = useMemo(
    () => [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Nexo PDV',
        url: typeof window === 'undefined' ? undefined : window.location.origin,
        logo:
          typeof window === 'undefined'
            ? undefined
            : `${window.location.origin}/brand/nexo-logo.svg`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Nexo PDV',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description:
          'Sistema PDV web para mercadinhos com caixa, estoque, fiados, financeiro, relatórios e controle de equipe.',
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: '79',
          highPrice: '229',
          priceCurrency: 'BRL',
          availability: 'https://schema.org/InStock',
        },
        featureList: [
          'PDV web',
          'Controle de estoque',
          'Relatórios de vendas',
          'Controle de fiados',
          'Financeiro',
          'Permissões de usuários',
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQS.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
    [],
  );

  usePageMetadata({
    title: 'Nexo PDV | Sistema de caixa e gestão para mercadinhos',
    description:
      'PDV web para mercadinhos: venda rápido, controle estoque, organize fiados, acompanhe financeiro e relatórios em uma única plataforma.',
    keywords:
      'pdv para mercadinho, sistema para mercadinho, sistema de caixa, controle de estoque, pdv web, gestão para mercado, frente de caixa',
    robots: 'index, follow, max-image-preview:large',
    canonicalPath: '/',
    imagePath: '/nexo-pdv-og.png',
    structuredData,
  });

  return (
    <div className="h-dvh overflow-y-auto overflow-x-hidden bg-white text-slate-950 antialiased selection:bg-emerald-200">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#031b15]/95 text-white shadow-[0_12px_34px_rgba(3,27,21,0.18)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#inicio" aria-label="Ir para o início">
            <Logo light />
          </a>
          <nav
            className="hidden items-center gap-9 text-sm font-bold text-white/80 lg:flex"
            aria-label="Navegação principal"
          >
            <a href="#produto" className="transition hover:text-[#18c987]">
              Produto
            </a>
            <a href="#recursos" className="transition hover:text-[#18c987]">
              Recursos
            </a>
            <a href="#planos" className="transition hover:text-[#18c987]">
              Planos
            </a>
            <a href="#duvidas" className="transition hover:text-[#18c987]">
              Ajuda
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-white/25 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15"
            >
              Entrar
            </Link>
            <CtaButton href={contactHref} className="hidden !min-h-9 sm:inline-flex">
              Fale pelo WhatsApp
              <MessageCircle className="h-4 w-4" />
            </CtaButton>
          </div>
        </div>
      </header>

      <main>
        <section
          id="inicio"
          className="relative isolate overflow-hidden bg-[#031b15] pt-8 text-white"
        >
          <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_72%_42%,rgba(24,201,135,0.18),transparent_34%),linear-gradient(180deg,rgba(3,27,21,1),rgba(3,27,21,0.98))]" />
          <div className="absolute bottom-0 left-0 right-0 -z-10 h-px bg-emerald-300/25" />

          <div className="mx-auto grid min-h-[640px] max-w-7xl items-center gap-10 px-4 pb-14 pt-8 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-emerald-200">
                <Store className="h-3.5 w-3.5" />
                Sistema de gestão para mercadinhos
              </span>
              <h1 className="mt-5 max-w-2xl text-balance text-4xl font-black leading-[1.02] sm:text-6xl">
                Simples de usar. Completo para{' '}
                <span className="text-[#18c987]">vender mais.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-emerald-50/80">
                O Nexo PDV ajuda mercadinhos a vender rápido, controlar estoque,
                organizar finanças e tomar decisões com clareza, tudo em uma
                única plataforma.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <CtaButton href={contactHref}>
                  Fale pelo WhatsApp
                  <MessageCircle className="h-4 w-4" />
                </CtaButton>
                <CtaButton href="#planos" variant="dark">
                  Ver planos
                  <ArrowRight className="h-4 w-4" />
                </CtaButton>
              </div>
              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
                {HERO_BADGES.map(({ label, Icon }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 text-sm font-semibold text-emerald-50/80"
                  >
                    <Icon className="h-4 w-4 text-[#18c987]" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <ProductMockup />
          </div>
        </section>
        <section id="recursos" className="scroll-mt-20 bg-[#f7faf8] py-14 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Feito para a rotina do seu mercado"
              title="Tudo que você precisa, em um só lugar"
              text="Recursos essenciais que simplificam o dia a dia e fazem seu mercadinho crescer."
            />
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {FEATURE_CARDS.map((item) => (
                <FeatureCard key={item.title} {...item} />
              ))}
            </div>
            <div className="mt-8">
              <MetricStrip />
            </div>
          </div>
        </section>

        <section id="produto" className="scroll-mt-20 bg-white py-14 sm:py-16 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-16 px-4 sm:px-6 lg:px-8">
            {SHOWCASES.map((item) => (
              <Showcase key={item.title} item={item} />
            ))}
          </div>
        </section>

        <section id="planos" className="scroll-mt-20 bg-[#f7faf8] py-14 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-6xl rounded-2xl border border-emerald-100 bg-white/75 px-4 py-10 shadow-[0_24px_70px_rgba(15,23,42,0.06)] sm:px-8 lg:px-12">
            <SectionHeader
              eyebrow="Planos para cada momento"
              title="Escolha o plano ideal para o seu negócio"
              text="Comece simples e evolua quando precisar."
            />
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <PlanCard
                  key={plan.name}
                  plan={plan}
                  contactHref={contactHref}
                />
              ))}
            </div>
            <p className="mt-6 text-center text-sm font-semibold text-slate-500">
              Todos os planos incluem atualizações automáticas e suporte humanizado.
            </p>
          </div>
        </section>

        <section
          id="duvidas"
          className="scroll-mt-20 bg-[#031b15] py-14 text-white sm:py-16 lg:py-20"
        >
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-200">
                <Check className="h-3.5 w-3.5" />
                Dúvidas frequentes
              </span>
              <h2 className="mt-4 text-balance text-3xl font-black leading-tight">
                Respostas rápidas para você continuar
              </h2>
              <div className="mt-8 hidden rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-6 lg:block">
                <ClipboardList className="h-16 w-16 text-[#18c987]" />
                <p className="mt-5 text-sm leading-6 text-emerald-50/75">
                  Tire as principais dúvidas e chame a equipe para ver o melhor
                  plano para sua operação.
                </p>
              </div>
            </div>
            <div className="grid gap-3">
              {FAQS.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-lg border border-white/10 bg-white/5 p-5 transition open:border-emerald-300/30 open:bg-white/10"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                    {item.question}
                    <ChevronDown className="h-4 w-4 shrink-0 text-emerald-200 transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-emerald-50/70">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-6 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-6 lg:grid-cols-[1fr_auto]">
              <div className="flex items-center gap-4">
                <MessageCircle className="h-12 w-12 shrink-0 text-[#18c987]" />
                <div>
                  <h2 className="text-2xl font-black">
                    Um PDV moderno para mercados que querem ir além
                  </h2>
                  <p className="mt-1 text-sm text-emerald-50/75">
                    Teste o Nexo PDV grátis por 7 dias e veja a diferença no seu dia.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <CtaButton href={contactHref}>
                  Fale pelo WhatsApp
                  <MessageCircle className="h-4 w-4" />
                </CtaButton>
                <CtaButton href="#planos" variant="dark">
                  Ver planos
                </CtaButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#031b15] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:px-8">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm leading-6 text-emerald-50/70">
              Sistema de gestão completo para mercadinhos de bairro.
            </p>
          </div>
          <FooterColumn title="Produto" items={['Funcionalidades', 'Planos', 'Integrações']} />
          <FooterColumn title="Recursos" items={['Blog', 'Materiais', 'Cases']} />
          <div>
            <h3 className="text-sm font-black">Fale com a gente</h3>
            <CtaButton href={contactHref} className="mt-4">
              WhatsApp
              <MessageCircle className="h-4 w-4" />
            </CtaButton>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-emerald-50/60">
          © {new Date().getFullYear()} Nexo PDV. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, items }) {
  return (
    <div>
      <h3 className="text-sm font-black">{title}</h3>
      <ul className="mt-4 grid gap-2 text-sm text-emerald-50/70">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
