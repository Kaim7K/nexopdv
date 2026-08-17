import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import '@/styles/landing.css';
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

/** @type {Array<[string, string, import('react').ElementType]>} */
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

function useLandingReveal() {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll('[data-landing-reveal]'),
    );
    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}

function cssVariable(name, value) {
  return /** @type {import('react').CSSProperties} */ ({ [name]: value });
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
    primary: 'landing-button--primary',
    dark: 'landing-button--glass',
    light: 'landing-button--light',
  };

  return (
    <ExternalAnchor
      href={href}
      className={`landing-button ${variants[variant]} ${className}`}
    >
      {children}
    </ExternalAnchor>
  );
}

function SectionHeader({ eyebrow, title, text, light = false }) {
  return (
    <div className="landing-section-header mx-auto max-w-3xl text-center" data-landing-reveal>
      <span
        className={`landing-kicker ${
          light
            ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200'
            : 'border-emerald-200 bg-emerald-50 text-[#0c8f60]'
        }`}
      >
        <Check className="h-3.5 w-3.5" />
        {eyebrow}
      </span>
      <h2
        className={`landing-section-title mt-4 text-balance font-black ${
          light ? 'text-white' : 'text-slate-950'
        }`}
      >
        {title}
      </h2>
      <p
        className={`mx-auto mt-4 max-w-2xl text-sm leading-7 sm:text-base ${
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
    <div className="landing-mockup relative mx-auto w-full max-w-3xl lg:max-w-none" data-landing-reveal>
      <div className="landing-mockup-glow absolute -inset-8 rounded-[3rem] blur-3xl" />
      <figure className="landing-mockup-frame relative p-2.5">
        <div className="overflow-hidden rounded-[1.2rem] bg-white">
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
      <div className="landing-floating-card absolute -bottom-8 right-4 hidden w-52 p-5 text-white sm:block">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-200">Venda concluída</span>
        <strong className="mt-2 block text-2xl font-black text-emerald-300">
          R$ 68,40
        </strong>
        <p className="mt-1 text-xs text-emerald-50/70">em segundos</p>
      </div>
    </div>
  );
}

function FeatureCard({ Icon, title, text, index }) {
  return (
    <article
      className="landing-feature-card"
      data-landing-reveal
      style={cssVariable('--reveal-delay', `${index * 55}ms`)}
    >
      <div className="relative z-10 flex items-start gap-4">
        <span className="landing-feature-icon grid h-12 w-12 shrink-0 place-items-center">
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
    <div className="landing-metrics grid overflow-hidden text-white md:grid-cols-4" data-landing-reveal>
      {METRICS.map(([value, label, Icon]) => (
        <div
          key={value}
          className="landing-metric flex items-center gap-4 p-6"
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
      className={`landing-showcase grid items-center gap-10 lg:grid-cols-2 lg:gap-20 ${
        item.reverse ? 'lg:[&>figure]:order-first' : ''
      }`}
      data-landing-reveal
    >
      <div>
        <span className="landing-kicker border-emerald-200 bg-emerald-50 text-[#0c8f60]">
          <Check className="h-3.5 w-3.5" />
          {item.eyebrow}
        </span>
        <h3 className="landing-showcase-title mt-5 text-balance font-black text-slate-950">
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
      <figure className="landing-showcase-frame p-2.5">
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
      className={`landing-plan-card relative flex min-h-full flex-col p-7 ${
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
  useLandingReveal();

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
    <div className="landing-premium h-dvh overflow-y-auto overflow-x-hidden bg-white text-slate-950 antialiased selection:bg-emerald-200">
      <header className="landing-nav sticky top-0 z-50 text-white">
        <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#inicio" aria-label="Ir para o início">
            <Logo light />
          </a>
          <nav
            className="landing-nav-links hidden items-center gap-9 text-[13px] font-bold text-white/70 lg:flex"
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
              className="landing-login-button inline-flex min-h-10 items-center justify-center px-5 text-sm font-bold text-white"
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
          className="landing-hero relative isolate overflow-hidden text-white"
        >
          <div className="landing-hero-backdrop absolute inset-0 -z-20" />
          <div className="landing-hero-grid absolute inset-0 -z-10" />
          <div className="absolute bottom-0 left-0 right-0 -z-10 h-px bg-emerald-300/25" />

          <div className="mx-auto grid min-h-[calc(100dvh-72px)] max-w-[1320px] items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[0.84fr_1.16fr] lg:px-8 lg:py-24">
            <div className="landing-hero-copy" data-landing-reveal>
              <span className="landing-kicker border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                <Store className="h-3.5 w-3.5" />
                Sistema de gestão para mercadinhos
              </span>
              <h1 className="landing-display mt-7 max-w-2xl text-balance font-black">
                Simples de usar. Completo para{' '}
                <span className="landing-gradient-text">vender mais.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-emerald-50/72 sm:text-lg">
                O Nexo PDV ajuda mercadinhos a vender rápido, controlar estoque,
                organizar finanças e tomar decisões com clareza, tudo em uma
                única plataforma.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CtaButton href={contactHref}>
                  Fale pelo WhatsApp
                  <MessageCircle className="h-4 w-4" />
                </CtaButton>
                <CtaButton href="#planos" variant="dark">
                  Ver planos
                  <ArrowRight className="h-4 w-4" />
                </CtaButton>
              </div>
              <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-2">
                {HERO_BADGES.map(({ label, Icon }, index) => (
                  <div
                    key={label}
                    className="landing-hero-badge flex items-center gap-2.5 text-sm font-semibold text-emerald-50/80"
                    style={cssVariable('--badge-delay', `${index * 60}ms`)}
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
        <section id="recursos" className="landing-section landing-section--tint scroll-mt-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Feito para a rotina do seu mercado"
              title="Tudo que você precisa, em um só lugar"
              text="Recursos essenciais que simplificam o dia a dia e fazem seu mercadinho crescer."
            />
            <div className="landing-bento mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {FEATURE_CARDS.map((item, index) => (
                <FeatureCard key={item.title} {...item} index={index} />
              ))}
            </div>
            <div className="mt-12">
              <MetricStrip />
            </div>
          </div>
        </section>

        <section id="produto" className="landing-section scroll-mt-20 bg-white">
          <div className="mx-auto grid max-w-[1320px] gap-24 px-4 sm:px-6 lg:gap-32 lg:px-8">
            {SHOWCASES.map((item) => (
              <Showcase key={item.title} item={item} />
            ))}
          </div>
        </section>

        <section id="planos" className="landing-section landing-section--tint scroll-mt-20">
          <div className="landing-pricing-shell mx-auto max-w-6xl px-4 py-12 sm:px-8 lg:px-12 lg:py-16" data-landing-reveal>
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
          className="landing-dark-section scroll-mt-20 text-white"
        >
          <div className="mx-auto grid max-w-[1320px] gap-12 px-4 sm:px-6 lg:grid-cols-[0.68fr_1.32fr] lg:px-8">
            <div data-landing-reveal>
              <span className="landing-kicker border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
                <Check className="h-3.5 w-3.5" />
                Dúvidas frequentes
              </span>
              <h2 className="landing-section-title mt-5 text-balance font-black">
                Respostas rápidas para você continuar
              </h2>
              <div className="landing-faq-aside mt-10 hidden p-7 lg:block">
                <ClipboardList className="h-16 w-16 text-[#18c987]" />
                <p className="mt-5 text-sm leading-6 text-emerald-50/75">
                  Tire as principais dúvidas e chame a equipe para ver o melhor
                  plano para sua operação.
                </p>
              </div>
            </div>
            <div className="grid gap-3" data-landing-reveal>
              {FAQS.map((item) => (
                <details
                  key={item.question}
                  className="landing-faq group p-6"
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

          <div className="mx-auto mt-16 max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <div className="landing-final-cta grid items-center gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_auto]" data-landing-reveal>
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

      <footer className="landing-footer text-white">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:px-8">
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
