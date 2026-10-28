import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  MessageCircle,
  Monitor,
  Package,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { PLAN_CATALOG } from "@/lib/plan-catalog";
import { SITE_ORIGIN } from "@/config/seo";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import "@/styles/landing.css";

const contact = (plan = "") =>
  `https://wa.me/5571984793504?text=${encodeURIComponent(plan ? `Olá! Quero conhecer o plano ${plan} do Nexo PDV e confirmar as condições de contratação.` : "Olá! Quero solicitar uma demonstração do Nexo PDV para o meu comércio.")}`;
const IMAGE = "/landing/product/";
/** @type {Array<[string, string, import('react').ElementType]>} */
const BENEFITS = [
  [
    "Venda com agilidade",
    "Registre produtos por nome ou código de barras e finalize pagamentos com facilidade.",
    ShoppingCart,
  ],
  [
    "Estoque organizado",
    "Controle produtos, preços, custos e quantidades.",
    Package,
  ],
  [
    "Informações sob controle",
    "Acompanhe vendas, faturamento e resultados.",
    Monitor,
  ],
  [
    "Gestão que cresce com você",
    "Acesse funcionalidades mais avançadas conforme sua operação evolui.",
    ShieldCheck,
  ],
];
const FLOW = [
  [
    "Selecione os produtos",
    "Busque pelo nome ou utilize um leitor de código de barras.",
    "catalog",
  ],
  [
    "Organize o carrinho",
    "Confira quantidades, produtos e o total da venda.",
    "sale",
  ],
  [
    "Registre o pagamento",
    "Selecione a forma de pagamento e conclua o atendimento.",
    "payment",
  ],
  [
    "Entregue o recibo",
    "Consulte, imprima ou salve o recibo da venda.",
    "receipt",
  ],
];
const FEATURES = {
  essencial: [
    "1 usuário",
    "Vendas completas com código de barras",
    "Pagamentos, descontos e recibos",
    "Cadastro e controle de estoque",
    "Importação e exportação de produtos",
    "Histórico e relatórios básicos",
    "Registro de receitas e despesas",
    "Personalização da empresa",
  ],
  profissional: [
    "Até 5 usuários",
    "Vendas simultâneas",
    "Controle completo de fiados",
    "Estoque avançado e edição em lote",
    "Gestão de fornecedores",
    "Contas a pagar e receber",
    "Fluxo de caixa e relatórios avançados",
    "Desempenho por produto e vendedor",
  ],
  completo: [
    "Até 15 usuários",
    "Abertura e fechamento de caixa",
    "Conferências, diferenças e revisões",
    "Compras integradas ao estoque e financeiro",
    "DRE, metas e conciliação financeira",
    "Despesas recorrentes",
    "Alertas automáticos de reposição",
    "Pesquisa automática de imagens",
    "Controle avançado de permissões",
  ],
};
const COMPARISON = [
  ["Usuários", "1", "Até 5", "Até 15"],
  ["Vendas, estoque e relatórios básicos", "Sim", "Sim", "Sim"],
  ["Vendas simultâneas e fiados", "—", "Sim", "Sim"],
  ["Financeiro e relatórios avançados", "—", "Sim", "Sim"],
  ["Controle de caixa", "—", "—", "Sim"],
  ["Compras integradas e automações", "—", "—", "Sim"],
];
const FAQS = [
  [
    "Preciso instalar algum programa?",
    "Não. O Nexo PDV é um sistema web, acessado pelo navegador.",
  ],
  [
    "Posso usar pelo celular?",
    "A interface se adapta a telas menores. O fluxo de produtos, carrinho e pagamento apresentado nesta página foi testado em viewport mobile. Para uma operação de caixa contínua, o computador oferece mais espaço para trabalhar.",
  ],
  [
    "Preciso de conexão com a internet?",
    "Sim. O funcionamento completo depende de conexão com a internet. O Nexo PDV não oferece operação de vendas offline.",
  ],
  [
    "Funciona com leitor de código de barras?",
    "O PDV permite buscar produtos por código de barras. Leitores que enviam o código como um teclado podem ser utilizados; confirme a compatibilidade do seu equipamento na demonstração.",
  ],
  [
    "Qual é a diferença entre os planos?",
    "Os modelos de lançamento diferenciam equipe, vendas simultâneas, fiados, análises, controle de caixa e automações. A comparação acima mostra as principais diferenças. Confirme a disponibilidade e as condições com o atendimento.",
  ],
  [
    "Posso mudar de plano?",
    "A alteração de plano é feita pela administração. Solicite ao atendimento a avaliação da mudança, dos limites de usuários e de eventuais caixas abertos.",
  ],
  [
    "Como funcionam suporte e cancelamento?",
    "Fale com o atendimento pelo WhatsApp para conhecer as condições de suporte e solicitar cancelamento. Prazos, valores e condições devem ser confirmados antes da contratação.",
  ],
  [
    "O sistema emite recibos e documentos fiscais?",
    "O Nexo PDV gera recibos de venda, com impressão e PDF. Recibos não substituem documentos fiscais. Esta apresentação não inclui emissão de NFC-e ou NF-e.",
  ],
];

// No IDs, customer data, cookies or network requests. A configured analytics
// integration can listen for this allowlisted event after obtaining consent.
function track(action, placement, plan = "") {
  window.dispatchEvent(
    new CustomEvent("nexo:marketing", {
      detail: { action, placement, ...(plan ? { plan } : {}) },
    }),
  );
}
/** @param {{children?: import('react').ReactNode, placement: string, plan?: string, secondary?: boolean}} props */
function CTA({
  children = "Solicitar demonstração",
  placement,
  plan = "",
  secondary = false,
}) {
  return (
    <a
      href={contact(plan)}
      target="_blank"
      rel="noopener noreferrer"
      className={`lp-button ${secondary ? "lp-button-secondary" : ""}`}
      onClick={() => {
        track(plan ? "select_plan" : "request_demo", placement, plan);
        track("whatsapp", placement, plan);
      }}
    >
      {children}
      <ArrowRight size={17} aria-hidden="true" />
    </a>
  );
}
function Screen({ name, alt, eager = false, className = "" }) {
  return (
    <figure className={`lp-screen ${className}`}>
      <div className="lp-screen-bar" aria-hidden="true">
        <span className="lp-window-dots">
          <i />
          <i />
          <i />
        </span>
        <span>Nexo PDV</span>
        <span className="lp-window-status">Sistema de gestão</span>
      </div>
      <a
        href={`${IMAGE}${name}.png`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ampliar: ${alt}`}
      >
        <img
          src={`${IMAGE}${name}.png`}
          alt={alt}
          width="1440"
          height="1000"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
        />
      </a>
      <figcaption>
        Interface real · dados de demonstração <span>Ampliar ↗</span>
      </figcaption>
    </figure>
  );
}
function Heading({ eyebrow, title, children }) {
  return (
    <div className="lp-heading">
      <p className="lp-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}
export function getLandingStructuredData() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Nexo PDV",
      url: `${SITE_ORIGIN}/`,
      logo: `${SITE_ORIGIN}/brand/nexo-logo.svg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Nexo PDV",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Sistema PDV web para mercadinhos com vendas, estoque, fiados, financeiro e relatórios.",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];
}
export default function Landing() {
  const [step, setStep] = useState(0);
  const [offers, setOffers] = useState([]);
  const structuredData = useMemo(getLandingStructuredData, []);
  usePageMetadata({
    title: "Nexo PDV | Sistema de caixa e gestão para mercadinhos",
    description:
      "Gerencie vendas, produtos, estoque e financeiro em um sistema simples, feito para facilitar a rotina do seu comércio.",
    robots: "index, follow, max-image-preview:large",
    canonicalPath: "/",
    imagePath: "/nexo-pdv-og.png",
    structuredData,
  });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/plans", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.plans))
          setOffers(
            data.plans.filter((offer) =>
              PLAN_CATALOG.some(
                (plan) =>
                  plan.key === offer.key &&
                  plan.monthly_price === offer.monthly_price &&
                  plan.user_limit === offer.user_limit,
              ),
            ),
          );
      })
      .catch(() => {
        /* Keep safe contact pricing when offers are not configured. */
      });
    return () => controller.abort();
  }, []);
  return (
    <div className="landing-premium lp-root">
      <header className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <a href="#inicio" aria-label="Nexo PDV — início">
            <img
              src="/brand/nexo-logo-white.svg"
              alt="Nexo PDV"
              width="130"
              height="52"
            />
          </a>
          <nav aria-label="Navegação principal">
            <a href="#demonstracao">O sistema</a>
            <a href="#recursos">Recursos</a>
            <a href="#planos">Planos</a>
            <a href="#duvidas">Dúvidas</a>
          </nav>
          <div className="lp-nav-actions">
            <Link to="/login">Entrar</Link>
            <CTA placement="header" />
          </div>
        </div>
      </header>
      <main>
        <section id="inicio" className="lp-hero">
          <div className="lp-container lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-eyebrow">
                Seu comércio. Uma rotina mais simples.
              </p>
              <h1>
                Seu mercado organizado.
                <br />
                <span>Suas vendas mais rápidas.</span>
              </h1>
              <p className="lp-lead">
                Gerencie vendas, produtos, estoque e financeiro em um sistema
                simples, feito para facilitar a rotina do seu comércio.
              </p>
              <div className="lp-actions">
                <CTA placement="hero" />
                <a
                  className="lp-text-link"
                  href="#demonstracao"
                  onClick={() => track("view_product", "hero")}
                >
                  Conhecer o sistema <ArrowRight size={17} />
                </a>
              </div>
              <p className="lp-hero-note">
                <Check size={15} /> Sistema web, sem instalação <span>·</span>{" "}
                Para mercadinhos e pequenos comércios
              </p>
            </div>
            <Screen
              name="sale"
              alt="Tela real de vendas do Nexo PDV com catálogo de produtos, carrinho e botão de pagamento"
              eager
              className="lp-hero-screen"
            />
          </div>
        </section>
        <section
          className="lp-benefits lp-container"
          aria-label="Benefícios do Nexo PDV"
        >
          {BENEFITS.map(([title, text, Icon]) => (
            <article key={String(title)}>
              <Icon size={24} strokeWidth={1.6} aria-hidden="true" />
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>
        <section id="demonstracao" className="lp-section lp-soft">
          <div className="lp-container">
            <Heading
              eyebrow="Veja o produto de verdade"
              title="Do primeiro produto ao recibo."
            >
              Um fluxo direto para atender bem, conferir a venda e seguir para o
              próximo cliente.
            </Heading>
            <div className="lp-flow" aria-label="Etapas de uma venda">
              {FLOW.map(([title, text], index) => (
                <button
                  type="button"
                  key={title}
                  aria-pressed={step === index}
                  onClick={() => setStep(index)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </button>
              ))}
            </div>
            <Screen
              name={FLOW[step][2]}
              alt={`Tela real do Nexo PDV: ${FLOW[step][0]}`}
            />
            <div className="lp-after-demo">
              <p>Veja como o Nexo se encaixa na rotina do seu mercado.</p>
              <CTA placement="after_demo" />
            </div>
          </div>
        </section>
        <section id="recursos" className="lp-section">
          <div className="lp-container">
            <Heading
              eyebrow="Organização em cada etapa"
              title="O seu dia a dia, com mais controle."
            >
              Produtos, atendimento e resultados conectados à rotina do seu
              comércio.
            </Heading>
            <article className="lp-editorial">
              <div>
                <p className="lp-eyebrow">01 · PDV e vendas</p>
                <h3>Atendimento rápido. Conferência fácil.</h3>
                <p>
                  Encontre produtos por nome ou código de barras, ajuste
                  quantidades e registre pagamentos. O recibo fica disponível
                  após a conclusão.
                </p>
                <p className="lp-availability">
                  Vendas completas nos três modelos de plano.
                </p>
              </div>
              <Screen
                name="sale"
                alt="Produtos e carrinho de uma venda no Nexo PDV"
              />
            </article>
            <article className="lp-stock">
              <div>
                <p className="lp-eyebrow">02 · Estoque</p>
                <h3>Produtos, preços e quantidades à vista.</h3>
                <p>
                  Cadastre, importe e exporte produtos. Atualize os dados de
                  cada item e acompanhe seu estoque. A edição em lote está no
                  Profissional e Completo.
                </p>
              </div>
              <Screen
                name="stock"
                alt="Tela real do estoque com produtos, preços e quantidades"
              />
            </article>
          </div>
        </section>
        <section className="lp-section lp-dark">
          <div className="lp-container">
            <div className="lp-split-heading">
              <p className="lp-eyebrow">03 · Vendas simultâneas</p>
              <h2>
                Pause um atendimento.
                <br />
                <span>Continue outro.</span>
              </h2>
              <p>
                Minimize uma venda e retome seus produtos quando o cliente
                voltar. Disponível nos modelos Profissional e Completo.
              </p>
            </div>
            <Screen
              name="simultaneous"
              alt="Tela real com uma venda em andamento e outro atendimento minimizado"
            />
          </div>
        </section>
        <section className="lp-section">
          <div className="lp-container lp-experiences">
            <article>
              <p className="lp-eyebrow">04 · Controle de caixa · Completo</p>
              <h3>Abra, feche e confira.</h3>
              <p>
                Acompanhe sessões, valores e diferenças. As conferências e
                revisões ajudam a entender cada fechamento.
              </p>
              <Screen
                name="cash"
                alt="Histórico real de caixas com sessões e conferências"
              />
            </article>
            <article>
              <p className="lp-eyebrow">05 · Relatórios</p>
              <h3>Transforme vendas em informação.</h3>
              <p>
                Vendas e faturamento no Essencial. Análises avançadas por
                produto e vendedor no Profissional e Completo.
              </p>
              <Screen
                name="reports"
                alt="Relatórios avançados reais do Nexo PDV, disponíveis a partir do Profissional"
              />
            </article>
          </div>
        </section>
        <section className="lp-section lp-soft">
          <div className="lp-container">
            <Heading
              eyebrow="Computador e celular"
              title="Seu negócio na tela, onde você estiver."
            >
              Mais espaço para operar no computador. Uma interface que também se
              adapta ao celular.
            </Heading>
            <div className="lp-devices">
              <Screen name="sale" alt="Interface do PDV no computador" />
              <figure className="lp-phone">
                <a
                  href={`${IMAGE}mobile-payment.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ampliar tela real de pagamento no celular"
                >
                  <img
                    src={`${IMAGE}mobile-payment.png`}
                    width="390"
                    height="844"
                    loading="lazy"
                    alt="Fluxo real de pagamento do Nexo PDV em viewport mobile testado"
                  />
                </a>
                <figcaption>
                  Pagamento em tela mobile testado com dados de demonstração.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>
        <section
          className="lp-trust lp-container"
          aria-label="Características verificáveis"
        >
          <p>Uma base simples para trabalhar com confiança.</p>
          <ul>
            <li>
              <Check /> Sistema web, sem instalação
            </li>
            <li>
              <Check /> Gestão de produtos e vendas
            </li>
            <li>
              <Check /> Controle de acesso e permissões
            </li>
            <li>
              <Check /> Recibos e interface responsiva
            </li>
          </ul>
        </section>
        <section id="planos" className="lp-section lp-soft">
          <div className="lp-container">
            <Heading
              eyebrow="Modelos de lançamento"
              title="O plano certo para o seu momento."
            >
              Comece com organização e avance conforme a sua operação precisa.
            </Heading>
            <div className="lp-plans">
              {PLAN_CATALOG.map((plan) => {
                const offer = offers.find((item) => item.key === plan.key);
                return (
                  <article
                    className={`lp-plan ${plan.key === "profissional" ? "lp-plan-featured" : ""}`}
                    key={plan.key}
                  >
                    {plan.key === "profissional" && (
                      <p className="lp-plan-badge">Recomendado</p>
                    )}
                    <h3>{plan.name}</h3>
                    <div className="lp-price">
                      <strong>
                        {offer
                          ? offer.monthly_price.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                          : "Sob consulta"}
                      </strong>
                      {offer && <span>/mês</span>}
                    </div>
                    <p>{plan.description}</p>
                    <p className="lp-includes">
                      {plan.key === "profissional"
                        ? "Tudo do Essencial, mais:"
                        : plan.key === "completo"
                          ? "Tudo do Profissional, mais:"
                          : "O essencial para o seu dia a dia:"}
                    </p>
                    <ul>
                      {FEATURES[plan.key].map((feature) => (
                        <li key={feature}>
                          <Check size={15} aria-hidden="true" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <CTA
                      placement="plans"
                      plan={plan.name}
                      secondary={plan.key !== "profissional"}
                    >
                      Conhecer o {plan.name}
                    </CTA>
                  </article>
                );
              })}
            </div>
            <p className="lp-commercial-note">
              Contratação assistida pelo WhatsApp. Confirme os valores, a
              disponibilidade e as condições com o atendimento.
            </p>
            <div className="lp-comparison">
              <h3>Compare o que faz diferença.</h3>
              <table>
                <caption className="sr-only">
                  Diferenças entre os três modelos de plano
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Recurso</th>
                    {PLAN_CATALOG.map((plan) => (
                      <th key={plan.key} scope="col">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map(([label, ...values]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      {values.map((value, index) => (
                        <td key={index}>{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <section id="duvidas" className="lp-section">
          <div className="lp-container lp-faq-grid">
            <Heading eyebrow="Perguntas frequentes" title="Antes de começar.">
              Respostas diretas para escolher com segurança.
            </Heading>
            <div className="lp-faq">
              {FAQS.map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    {question}
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="lp-section lp-final">
          <div className="lp-container">
            <p className="lp-eyebrow">Uma rotina mais organizada começa aqui</p>
            <h2>
              Mais clareza na gestão.
              <br />
              <span>Mais agilidade para vender.</span>
            </h2>
            <p>
              Conheça o Nexo PDV e veja o sistema funcionando antes de escolher
              seu plano.
            </p>
            <div className="lp-actions">
              <CTA placement="final" />
              <a
                href={contact()}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-text-link"
                onClick={() => track("whatsapp", "final")}
              >
                <MessageCircle size={18} /> Conversar pelo WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="lp-footer">
        <div className="lp-container">
          <div>
            <img
              src="/brand/nexo-logo-white.svg"
              alt="Nexo PDV"
              width="130"
              height="52"
            />
            <p>Vendas e gestão para o seu comércio.</p>
          </div>
          <nav aria-label="Links do rodapé">
            <a href="#demonstracao">Conhecer o sistema</a>
            <a href="#planos">Planos</a>
            <a href="#duvidas">Dúvidas</a>
            <Link to="/login">Entrar no sistema</Link>
          </nav>
          <a
            href={contact()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("whatsapp", "footer")}
          >
            WhatsApp · (71) 98479-3504
          </a>
          <small>
            © {new Date().getFullYear()} Nexo PDV. Todos os direitos
            reservados.
          </small>
        </div>
      </footer>
    </div>
  );
}
