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
  ['PDV', 'Venda, desconto, pagamento e recibo'],
  ['Estoque', 'Produtos, preços, importação e alertas'],
  ['Gestão', 'Fiados, usuários, auditoria e relatórios'],
];

const BENEFITS = [
  {
    title: 'Caixa rápido',
    description: 'Atenda com busca, leitor, desconto e pagamento misto.',
    Icon: Zap,
  },
  {
    title: 'Estoque controlado',
    description: 'Atualize preços, quantidades e cadastros em massa.',
    Icon: Boxes,
  },
  {
    title: 'Fiados organizados',
    description: 'Acompanhe clientes, vencimentos e recebimentos.',
    Icon: WalletCards,
  },
  {
    title: 'Equipe segura',
    description: 'Permissões por perfil e histórico de alterações.',
    Icon: ShieldCheck,
  },
];

const SHOWCASES = [
  {
    eyebrow: 'Frente de caixa',
    title: 'Venda sem travar o atendimento',
    description: 'Produtos, carrinho e pagamento ficam na mesma rotina.',
    image: APP_IMAGES.pdv,
    alt: 'Tela do PDV do Nexo com produtos, venda atual e atalhos de caixa',
    bullets: ['Leitor de código de barras', 'Vendas simultâneas', 'Recibo ao finalizar'],
    Icon: ShoppingCart,
  },
  {
    eyebrow: 'Estoque',
    title: 'Uma visão clara dos produtos',
    description: 'Tabela rápida para editar, filtrar, importar e corrigir.',
    image: APP_IMAGES.stock,
    alt: 'Tela de estoque do Nexo em modo de tabela com produtos cadastrados',
    bullets: ['Importação por planilha', 'Preço e quantidade em linha', 'Status de produto'],
    Icon: FileSpreadsheet,
  },
  {
    eyebrow: 'Relatórios',
    title: 'Indicadores para decidir hoje',
    description: 'Acompanhe vendas, pagamentos, produtos e desempenho.',
    image: APP_IMAGES.reports,
    alt: 'Tela de relatórios do Nexo com cartões de indicadores e gráficos',
    bullets: ['Faturamento e ticket médio', 'Produtos mais vendidos', 'Formas de pagamento'],
    Icon: BarChart3,
  },
];

const PLANS = [
  {
    name: 'Essencial',
    price: 'R$ 79',
    caption: 'para começar',
    description: 'PDV, estoque e vendas para mercados pequenos.',
    features: ['1 unidade', 'Até 2 usuários', 'Cadastro de produtos', 'Relatórios básicos'],
  },
  {
    name: 'Profissional',
    price: 'R$ 129',
    caption: 'mais escolhido',
    description: 'Gestão completa para operação diária com equipe.',
    features: ['Até 5 usuários', 'Fiados e auditoria', 'Importação de estoque', 'Alertas e relatórios'],
    featured: true,
  },
  {
    name: 'Gestão',
    price: 'Sob consulta',
    caption: 'para crescer',
    description: 'Mais unidades, suporte e controle avançado.',
    features: ['Usuários ampliados', 'Múltiplas unidades', 'Financeiro integrado', 'Apoio na implantação'],
  },
];

const FAQS = [
  {
    question: 'Funciona pelo navegador?',
    answer: 'Sim. O Nexo PDV roda na web e pode ser usado em computadores compatíveis.',
  },
  {
    question: 'Consigo importar produtos?',
    answer: 'Sim. A tela de estoque aceita importação por planilha e edição rápida.',
  },
  {
    question: 'O acesso da equipe é controlado?',
    answer: 'Sim. O sistema separa permissões por perfil e registra atividades importantes.',
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
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  const variants = {
    primary:
      'bg-[#16a06a] text-white shadow-lg shadow-emerald-900/15 hover:bg-[#12835a] focus-visible:outline-[#16a06a]',
    light:
      'bg-white text-[#0e3b2c] shadow-lg shadow-black/10 hover:bg-emerald-50 focus-visible:outline-white',
    outline:
      'border border-white/35 bg-white/10 text-white hover:bg-white/15 focus-visible:outline-white',
    muted:
      'border border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-[#16a06a]',
  };
  return (
    <ExternalAnchor href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </ExternalAnchor>
  );
}

function SectionHeader({ eyebrow, title, description, light = false }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase ${
          light
            ? 'bg-white/10 text-emerald-100'
            : 'bg-emerald-100 text-[#0f6b4a]'
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

function ScreenshotFrame({ src, alt, priority = false }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10">
      <div className="flex h-6 items-center gap-1.5 border-b border-slate-100 px-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <span className="ml-2 h-2 w-24 rounded bg-slate-100" />
      </div>
      <img
        src={src}
        alt={alt}
        width="1700"
        height="980"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        className="mt-2 block aspect-[16/9] w-full rounded-md object-cover object-top"
      />
    </figure>
  );
}

function FeatureCard({ title, description, Icon }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 flex-none place-items-center rounded-lg bg-emerald-100 text-[#12835a]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
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
    <article className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-12">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-[#0f6b4a]">
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
      className={`relative rounded-lg border p-6 shadow-sm ${
        plan.featured
          ? 'border-[#16a06a] bg-[#0e3b2c] text-white shadow-emerald-950/20'
          : 'border-slate-200 bg-white text-slate-950'
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
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0e3b2c]">
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
    <div className="min-h-screen overflow-x-hidden bg-[#f3faf6] text-slate-950 selection:bg-emerald-200">
      <header className="sticky top-0 z-50 border-b border-white/70 bg-[#f3faf6]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#inicio" aria-label="Ir para o início">
            <Logo />
          </a>

          <nav
            className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex"
            aria-label="Navegação principal"
          >
            <a className="hover:text-[#12835a]" href="#produto">
              Produto
            </a>
            <a className="hover:text-[#12835a]" href="#planos">
              Planos
            </a>
            <a className="hover:text-[#12835a]" href="#duvidas">
              Dúvidas
            </a>
          </nav>

          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#16a06a] bg-white px-4 text-sm font-bold text-[#0f6b4a] transition hover:bg-emerald-50"
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
          className="relative isolate overflow-hidden bg-[#0b241c] text-white"
        >
          <img
            src={APP_IMAGES.pdv}
            alt=""
            aria-hidden="true"
            width="1700"
            height="980"
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-[58%_top] opacity-80"
          />
          <div className="absolute inset-0 -z-10 bg-[#071c16]/58" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#061f18] via-[#061f18]/88 to-[#061f18]/32" />

          <div className="mx-auto flex min-h-[620px] max-w-7xl flex-col justify-center px-4 py-16 sm:px-6 lg:min-h-[680px] lg:px-8">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase text-emerald-100 backdrop-blur">
                <Store className="h-3.5 w-3.5" />
                PDV web para mercados de bairro
              </span>

              <h1 className="mt-5 text-4xl font-bold leading-[1.04] sm:text-5xl lg:text-6xl">
                Caixa, estoque e gestão em uma tela simples de operar.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-emerald-50/86 sm:text-lg sm:leading-8">
                O Nexo PDV ajuda mercadinhos a vender rápido, controlar produtos,
                organizar fiados e enxergar resultados sem complicação.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={contactHref} variant="light">
                  Falar pelo WhatsApp
                  <MessageCircle className="h-4 w-4" />
                </ButtonLink>
                <Link
                  to="/login"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/35 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15"
                >
                  Entrar no sistema
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-8 grid max-w-xl gap-2 sm:grid-cols-3">
                {QUICK_STATS.map(([label, text]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-white/16 bg-white/10 p-3 backdrop-blur"
                  >
                    <strong className="block text-sm font-bold text-white">
                      {label}
                    </strong>
                    <span className="mt-1 block text-xs leading-5 text-emerald-50/76">
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid max-w-xl gap-2 sm:grid-cols-4">
              {TRUST_ITEMS.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-white/14 bg-white/10 px-3 text-emerald-50 backdrop-blur"
                >
                  <Icon className="h-4 w-4 flex-none text-[#6dd4aa]" />
                  <span className="text-xs font-bold">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f3faf6] py-16 sm:py-20">
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
          </div>
        </section>

        <section id="produto" className="bg-white py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl space-y-16 px-4 sm:px-6 lg:px-8">
            {SHOWCASES.map((item) => (
              <Showcase key={item.title} item={item} />
            ))}
          </div>
        </section>

        <section className="bg-[#0e3b2c] py-16 text-white sm:py-20">
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
                  className="rounded-lg border border-white/12 bg-white/8 p-5"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-white/12 text-emerald-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-50/76">
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

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <PlanCard key={plan.name} plan={plan} contactHref={contactHref} />
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
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 sm:w-auto"
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
                  className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm open:border-emerald-300"
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

        <section className="bg-[#f3faf6] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-6 rounded-lg bg-[#0b241c] p-6 text-white shadow-xl shadow-slate-950/15 sm:p-8 lg:grid-cols-[1fr_auto]">
            <div>
              <Logo light />
              <h2 className="mt-5 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
                Um PDV moderno para o mercado vender melhor hoje.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/78 sm:text-base">
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

      <footer className="bg-[#0b241c] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-7 text-center text-sm text-emerald-50/75 sm:px-6 md:flex-row md:text-left lg:px-8">
          <Logo light />
          <p>© {new Date().getFullYear()} Nexo PDV. Sistema de gestão para mercados de bairro.</p>
        </div>
      </footer>
    </div>
  );
}
