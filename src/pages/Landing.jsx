import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  FileSpreadsheet,
  Headphones,
  LockKeyhole,
  MessageCircle,
  ReceiptText,
  ScanBarcode,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Upload,
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

const QUICK_STATS = [
  ['4 rotinas', 'PDV, estoque, fiados e relatórios no mesmo lugar'],
  ['Web', 'Acesse pelo navegador, sem instalação pesada'],
  ['Perfis', 'Equipe com permissões e histórico de ações'],
];

const BENEFITS = [
  {
    title: 'Caixa rápido',
    description: 'Atenda com busca, leitor, desconto e pagamento misto.',
    Icon: Zap,
    tone: 'emerald',
  },
  {
    title: 'Estoque controlado',
    description: 'Atualize preços, quantidades e cadastros em massa.',
    Icon: Boxes,
    tone: 'blue',
  },
  {
    title: 'Fiados organizados',
    description: 'Acompanhe clientes, vencimentos e recebimentos.',
    Icon: WalletCards,
    tone: 'amber',
  },
  {
    title: 'Equipe segura',
    description: 'Permissões por perfil e histórico de alterações.',
    Icon: ShieldCheck,
    tone: 'rose',
  },
];

const SHOWCASES = [
  {
    eyebrow: 'Frente de caixa',
    title: 'Venda sem travar o atendimento',
    description: 'Produtos, carrinho e pagamento ficam na mesma rotina.',
    image: APP_IMAGES.pdv,
    alt: 'Tela do PDV do Nexo com produtos, venda atual e atalhos de caixa',
    bullets: [
      'Leitor de código de barras',
      'Vendas simultâneas',
      'Recibo ao finalizar',
    ],
    Icon: ShoppingCart,
  },
  {
    eyebrow: 'Estoque',
    title: 'Uma visão clara dos produtos',
    description: 'Tabela rápida para editar, filtrar, importar e corrigir.',
    image: APP_IMAGES.stock,
    alt: 'Tela de estoque do Nexo em modo de tabela com produtos cadastrados',
    bullets: [
      'Importação por planilha',
      'Preço e quantidade em linha',
      'Status de produto',
    ],
    Icon: FileSpreadsheet,
    reverse: true,
  },
  {
    eyebrow: 'Relatórios',
    title: 'Indicadores para decidir hoje',
    description: 'Acompanhe vendas, pagamentos, produtos e desempenho.',
    image: APP_IMAGES.reports,
    alt: 'Tela de relatórios do Nexo com cartões de indicadores e gráficos',
    bullets: [
      'Faturamento e ticket médio',
      'Produtos mais vendidos',
      'Formas de pagamento',
    ],
    Icon: BarChart3,
  },
];

const PLANS = [
  {
    name: 'Essencial',
    price: 'R$ 79',
    caption: 'para começar',
    description: 'PDV, estoque e vendas para mercados pequenos.',
    features: [
      '1 unidade',
      'Até 2 usuários',
      'Cadastro de produtos',
      'Relatórios básicos',
    ],
  },
  {
    name: 'Profissional',
    price: 'R$ 129',
    caption: 'mais escolhido',
    description: 'Gestão completa para operação diária com equipe.',
    features: [
      'Até 5 usuários',
      'Fiados e auditoria',
      'Importação de estoque',
      'Alertas e relatórios',
    ],
    featured: true,
  },
  {
    name: 'Gestão',
    price: 'Sob consulta',
    caption: 'para crescer',
    description: 'Mais unidades, suporte e controle avançado.',
    features: [
      'Usuários ampliados',
      'Múltiplas unidades',
      'Financeiro integrado',
      'Apoio na implantação',
    ],
  },
];

const FAQS = [
  {
    question: 'Funciona pelo navegador?',
    answer:
      'Sim. O Nexo PDV roda na web e pode ser usado em computadores compatíveis.',
  },
  {
    question: 'Consigo importar produtos?',
    answer:
      'Sim. A tela de estoque aceita importação por planilha e edição rápida.',
  },
  {
    question: 'O acesso da equipe é controlado?',
    answer:
      'Sim. O sistema separa permissões por perfil e registra atividades importantes.',
  },
];

const TRUST_ITEMS = [
  { Icon: ScanBarcode, label: 'Leitor de código' },
  { Icon: Upload, label: 'Importação' },
  { Icon: ReceiptText, label: 'Recibos' },
  { Icon: LockKeyhole, label: 'Permissões' },
];

const TEAM_ROLES = [
  {
    title: 'Vendedor',
    text: 'PDV e rotinas de atendimento',
    Icon: ShoppingCart,
  },
  {
    title: 'Gerente',
    text: 'Estoque, fiados e relatórios',
    Icon: UsersRound,
  },
  {
    title: 'Administrador',
    text: 'Usuários, permissões e configurações',
    Icon: ShieldCheck,
  },
];

const TONE_CLASSES = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
};

function Logo({ light = false }) {
  return (
    <img
      src={light ? '/brand/nexo-logo-white.svg' : '/brand/nexo-logo.svg'}
      alt="Nexo PDV"
      className="h-9 w-auto max-w-[160px]"
    />
  );
}

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

function ExternalAnchor({ href, className, children, ...props }) {
  const external = href.startsWith('https://');
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
}

function ButtonLink({ href, children, variant = 'primary', className = '' }) {
  const base =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition duration-200 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-0';
  const variants = {
    primary:
      'bg-[#16a06a] text-white shadow-lg shadow-emerald-950/20 hover:bg-[#12835a] focus-visible:outline-[#16a06a]',
    light:
      'bg-white text-[#0b3528] shadow-lg shadow-black/15 hover:bg-emerald-50 focus-visible:outline-white',
    outline:
      'border border-white/30 bg-white/10 text-white hover:bg-white/15 focus-visible:outline-white',
    muted:
      'border border-slate-200 bg-white text-slate-950 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-[#16a06a]',
    dark:
      'bg-slate-950 text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800 focus-visible:outline-slate-950',
  };
  return (
    <ExternalAnchor
      href={href}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </ExternalAnchor>
  );
}

function SectionHeader({ eyebrow, title, description, light = false }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase ${
          light
            ? 'border-white/15 bg-white/10 text-emerald-100'
            : 'border-emerald-200 bg-emerald-50 text-[#0f6b4a]'
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {eyebrow}
      </span>
      <h2
        className={`mt-4 text-3xl font-bold leading-tight sm:text-4xl ${
          light ? 'text-white' : 'text-slate-950'
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-3 text-base leading-7 ${
            light ? 'text-emerald-50/80' : 'text-slate-600'
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}

function ScreenshotFrame({ src, alt, priority = false, compact = false }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-950/10">
      <div className="flex h-7 items-center gap-1.5 border-b border-slate-100 px-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <span className="ml-2 h-2 w-28 rounded bg-slate-100" />
      </div>
      <img
        src={src}
        alt={alt}
        width="1700"
        height="980"
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        className={`mt-2 block w-full rounded-md object-cover object-top ${
          compact ? 'aspect-[4/3]' : 'aspect-[16/9]'
        }`}
      />
    </figure>
  );
}

function FeatureCard({ title, description, Icon, tone }) {
  return (
    <article className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-950/10">
      <div
        className={`grid h-11 w-11 place-items-center rounded-lg ring-1 ${
          TONE_CLASSES[tone]
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}

function Bullet({ children, light = false }) {
  return (
    <li
      className={`flex items-start gap-2 text-sm font-semibold leading-6 ${
        light ? 'text-emerald-50' : 'text-slate-700'
      }`}
    >
      <span
        className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full ${
          light ? 'bg-white/15 text-white' : 'bg-emerald-100 text-[#12835a]'
        }`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      {children}
    </li>
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
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase text-[#0f6b4a]">
          <item.Icon className="h-3.5 w-3.5" />
          {item.eyebrow}
        </div>
        <h3 className="mt-4 text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
          {item.title}
        </h3>
        <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
          {item.description}
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {item.bullets.map((bullet) => (
            <Bullet key={bullet}>{bullet}</Bullet>
          ))}
        </ul>
      </div>
      <ScreenshotFrame src={item.image} alt={item.alt} />
    </article>
  );
}

function PlanCard({ plan, contactHref }) {
  return (
    <article
      className={`relative flex h-full flex-col rounded-lg border p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-2xl ${
        plan.featured
          ? 'border-[#16a06a] bg-[#0b3528] text-white shadow-emerald-950/25'
          : 'border-slate-200 bg-white text-slate-950 shadow-slate-950/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-bold uppercase ${
              plan.featured ? 'text-emerald-100' : 'text-[#0f6b4a]'
            }`}
          >
            {plan.caption}
          </p>
          <h3 className="mt-2 text-2xl font-bold">{plan.name}</h3>
        </div>
        {plan.featured && (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0b3528]">
            Popular
          </span>
        )}
      </div>
      <div className="mt-5 flex items-end gap-1">
        <strong className="text-4xl font-bold leading-none">{plan.price}</strong>
        {plan.price.startsWith('R$') && (
          <span
            className={`pb-1 text-sm ${
              plan.featured ? 'text-emerald-50/80' : 'text-slate-500'
            }`}
          >
            /mês
          </span>
        )}
      </div>
      <p
        className={`mt-4 min-h-12 text-sm leading-6 ${
          plan.featured ? 'text-emerald-50/85' : 'text-slate-600'
        }`}
      >
        {plan.description}
      </p>
      <ul className="mt-5 space-y-3">
        {plan.features.map((feature) => (
          <Bullet key={feature} light={plan.featured}>
            {feature}
          </Bullet>
        ))}
      </ul>
      <ButtonLink
        href={contactHref}
        variant={plan.featured ? 'light' : 'primary'}
        className="mt-6 w-full"
      >
        Falar pelo WhatsApp
        <MessageCircle className="h-4 w-4" />
      </ButtonLink>
    </article>
  );
}

export default function Landing() {
  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Nexo PDV',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description:
        'Sistema de caixa, estoque, fiados e relatórios para mercadinhos e mercados de bairro.',
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '79',
        priceCurrency: 'BRL',
        availability: 'https://schema.org/InStock',
      },
      publisher: { '@type': 'Organization', name: 'Nexo PDV' },
    }),
    [],
  );

  usePageMetadata({
    title: 'Nexo PDV | Caixa, estoque e gestão para mercadinhos',
    description:
      'PDV web para mercadinhos: venda rápido, controle estoque, organize fiados e acompanhe relatórios em uma só plataforma.',
    robots: 'index, follow, max-image-preview:large',
    canonicalPath: '/',
    imagePath: '/nexo-pdv-og.png',
    structuredData,
  });

  const contactHref = getWhatsAppHref();

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-950 selection:bg-emerald-200">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#inicio" aria-label="Ir para o início">
            <Logo />
          </a>

          <nav
            className="hidden items-center gap-8 text-sm font-bold text-slate-600 lg:flex"
            aria-label="Navegação principal"
          >
            <a className="transition hover:text-[#12835a]" href="#produto">
              Produto
            </a>
            <a className="transition hover:text-[#12835a]" href="#planos">
              Planos
            </a>
            <a className="transition hover:text-[#12835a]" href="#duvidas">
              Dúvidas
            </a>
          </nav>

          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-[#0f6b4a]"
            >
              Login
            </Link>
            <ButtonLink href={contactHref} className="hidden sm:inline-flex">
              WhatsApp
              <MessageCircle className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>
      </header>

      <main>
        <section
          id="inicio"
          className="relative isolate min-h-[calc(100dvh-72px)] overflow-hidden bg-[#071f18] text-white"
        >
          <img
            src={APP_IMAGES.pdv}
            alt=""
            aria-hidden="true"
            width="1700"
            height="980"
            loading="eager"
            className="absolute inset-0 -z-30 h-full w-full object-cover object-[58%_top] opacity-85"
          />
          <div className="absolute inset-0 -z-20 bg-[#061b15]/50" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#061b15_0%,rgba(6,27,21,0.92)_38%,rgba(6,27,21,0.58)_68%,rgba(6,27,21,0.18)_100%)]" />

          <div className="mx-auto grid min-h-[calc(100dvh-72px)] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.55fr)] lg:px-8">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase text-emerald-100 backdrop-blur">
                <Store className="h-3.5 w-3.5" />
                PDV web para mercados de bairro
              </span>

              <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl">
                Caixa, estoque e gestão em uma tela simples de operar.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-emerald-50/90 sm:text-lg sm:leading-8">
                O Nexo PDV ajuda mercadinhos a vender rápido, controlar
                produtos, organizar fiados e enxergar resultados sem
                complicação.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={contactHref} variant="light">
                  Falar pelo WhatsApp
                  <MessageCircle className="h-4 w-4" />
                </ButtonLink>
                <Link
                  to="/login"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/35 bg-white/10 px-5 text-sm font-bold text-white transition hover:-translate-y-px hover:bg-white/15 active:translate-y-0"
                >
                  Entrar no sistema
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <aside className="hidden rounded-lg border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/25 backdrop-blur-md lg:block">
              <ScreenshotFrame
                src={APP_IMAGES.reports}
                alt="Tela de relatórios do Nexo PDV"
                priority
                compact
              />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/10 p-4">
                  <span className="text-xs font-bold uppercase text-emerald-100">
                    Venda atual
                  </span>
                  <strong className="mt-2 block text-3xl font-bold">
                    R$ 92,77
                  </strong>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/10 p-4">
                  <span className="text-xs font-bold uppercase text-emerald-100">
                    Itens ativos
                  </span>
                  <strong className="mt-2 block text-3xl font-bold">
                    1.284
                  </strong>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="relative z-10 -mt-8 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/10 lg:grid-cols-3">
            {QUICK_STATS.map(([label, text]) => (
              <div
                key={label}
                className="border-b border-slate-200 p-6 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
              >
                <strong className="block text-lg font-bold text-slate-950">
                  {label}
                </strong>
                <span className="mt-1 block text-sm leading-6 text-slate-600">
                  {text}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#f4f8f6] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Operação completa"
              title="O essencial do mercado, sem telas confusas"
              description="Cada módulo resolve uma parte real do dia a dia."
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {BENEFITS.map((item) => (
                <FeatureCard key={item.title} {...item} />
              ))}
            </div>

            <div className="mt-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-4">
              {TRUST_ITEMS.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex min-h-12 items-center gap-3 rounded-lg bg-slate-50 px-3 text-slate-700"
                >
                  <Icon className="h-4 w-4 flex-none text-[#16a06a]" />
                  <span className="text-sm font-bold">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="produto" className="bg-white py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-end gap-6 lg:grid-cols-[0.82fr_1fr]">
              <SectionHeader
                eyebrow="Produto"
                title="Fluxos importantes ficam óbvios desde o primeiro dia"
                description="O visual do sistema foi pensado para operação: telas diretas, dados fáceis de comparar e ações sempre por perto."
              />
              <p className="hidden text-right text-sm font-semibold leading-6 text-slate-500 lg:block">
                Caixa, estoque e relatórios trabalham juntos para reduzir
                retrabalho e deixar o atendimento mais previsível.
              </p>
            </div>
            <div className="mt-14 space-y-20">
              {SHOWCASES.map((item) => (
                <Showcase key={item.title} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0b3528] py-16 text-white sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Para a equipe"
              title="Mais controle sem tirar velocidade do caixa"
              description="Perfis, auditoria e histórico deixam a operação previsível."
              light
            />

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {TEAM_ROLES.map(({ title, text, Icon }) => (
                <article
                  key={title}
                  className="rounded-lg border border-white/10 bg-white/10 p-6 transition hover:bg-white/15"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-white/10 text-emerald-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-50/75">
                    {text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="planos" className="bg-[#f6f8fb] py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Planos"
              title="Escolha o tamanho certo para sua operação"
              description="Comece simples e evolua quando o mercado precisar."
            />

            <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <PlanCard
                  key={plan.name}
                  plan={plan}
                  contactHref={contactHref}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm sm:flex-row sm:text-left">
              <div>
                <h3 className="font-bold text-slate-950">Já usa o Nexo PDV?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Acesse sua conta para continuar vendendo.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:-translate-y-px hover:bg-slate-800 active:translate-y-0 sm:w-auto"
              >
                Fazer login
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section id="duvidas" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Dúvidas"
              title="Respostas rápidas"
              description="O básico para entender antes de conversar."
            />
            <div className="mt-9 grid gap-4 lg:grid-cols-3">
              {FAQS.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition open:border-emerald-300 open:shadow-lg"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-950">
                    <span>{item.question}</span>
                    <ChevronDown className="h-4 w-4 flex-none text-slate-400 transition group-open:rotate-180 group-open:text-[#16a06a]" />
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f4f8f6] px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-8 rounded-lg bg-[#071f18] p-6 text-white shadow-2xl shadow-slate-950/20 sm:p-8 lg:grid-cols-[1fr_auto]">
            <div>
              <Logo light />
              <h2 className="mt-5 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
                Um PDV moderno para o mercado vender melhor hoje.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80 sm:text-base">
                Converse pelo WhatsApp e veja o melhor plano para sua operação.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <ButtonLink href={contactHref} variant="light">
                Chamar no WhatsApp
                <MessageCircle className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="mailto:contato@nexopdv.com.br" variant="outline">
                Falar por e-mail
                <Headphones className="h-4 w-4" />
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#071f18] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-7 text-center text-sm text-emerald-50/75 sm:px-6 md:flex-row md:text-left lg:px-8">
          <Logo light />
          <p>
            © {new Date().getFullYear()} Nexo PDV. Sistema de gestão para
            mercados de bairro.
          </p>
        </div>
      </footer>
    </div>
  );
}
