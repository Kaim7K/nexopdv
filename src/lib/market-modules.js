export const MARKET_MODULES = [
  {
    key: 'pdv',
    label: 'PDV',
    description: 'Operação de vendas e atendimento no caixa.',
  },
  {
    key: 'estoque',
    label: 'Estoque',
    description: 'Produtos, preços, quantidades e reposição.',
  },
  {
    key: 'vendas',
    label: 'Vendas',
    description: 'Histórico, recibos e cancelamentos de vendas.',
  },
  {
    key: 'caixas',
    label: 'Histórico de caixas',
    description: 'Consulta de sessões, diferenças e movimentações.',
  },
  {
    key: 'fiados',
    label: 'Fiados',
    description: 'Contas de clientes, pagamentos e pendências.',
  },
  {
    key: 'relatorios',
    label: 'Relatórios',
    description: 'Indicadores financeiros, produtos e desempenho.',
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    description: 'Despesas, contas, fluxo de caixa, compras e resultados.',
  },
  {
    key: 'auditoria',
    label: 'Auditoria',
    description: 'Rastreabilidade de alterações e ações sensíveis.',
  },
  {
    key: 'usuarios',
    label: 'Usuários',
    description: 'Equipe, perfis, permissões e acessos.',
  },
  {
    key: 'configuracoes',
    label: 'Configurações',
    description: 'Identidade, regras, integrações e alertas.',
  },
];

export const MARKET_MODULE_KEYS = MARKET_MODULES.map((module) => module.key);

export const MARKET_FEATURES = [
  {
    key: 'email_sending',
    label: 'Envio de e-mails',
    group: 'Comunicação',
    description: 'Permite testes, alertas e notificações por e-mail.',
  },
  {
    key: 'email_branding',
    label: 'Identidade nos e-mails',
    group: 'Comunicação',
    description: 'Aplica logo, cores, contatos e rodapé do mercadinho.',
  },
  {
    key: 'market_logo',
    label: 'Logo personalizada',
    group: 'Identidade visual',
    description: 'Permite cadastrar e exibir a marca do estabelecimento.',
  },
  {
    key: 'sidebar_customization',
    label: 'Cores da barra lateral',
    group: 'Identidade visual',
    description: 'Libera fundo e cor de destaque personalizados no menu.',
  },
  {
    key: 'automatic_image_search',
    label: 'Pesquisa automática de imagens',
    group: 'Produtos e estoque',
    description: 'Busca imagens de produtos pelo código de barras ou nome.',
  },
  {
    key: 'product_image_upload',
    label: 'Imagens nos produtos',
    group: 'Produtos e estoque',
    description: 'Permite enviar, colar e gerenciar imagens do catálogo.',
  },
  {
    key: 'stock_email_alerts',
    label: 'Alertas de reposição',
    group: 'Produtos e estoque',
    description: 'Agenda relatórios de estoque e envia aos destinatários.',
  },
  {
    key: 'quick_product_creation',
    label: 'Cadastro rápido no PDV',
    group: 'Operação',
    description: 'Cadastra produto não encontrado sem interromper a venda.',
  },
  {
    key: 'report_export',
    label: 'Exportação de relatórios',
    group: 'Relatórios',
    description: 'Libera exportações em planilha, PDF e impressão.',
  },
  {
    key: 'recurring_finance',
    label: 'Despesas recorrentes',
    group: 'Financeiro',
    description: 'Gera automaticamente contas semanais, mensais ou anuais.',
  },
  {
    key: 'integrated_purchases',
    label: 'Compras integradas',
    group: 'Financeiro',
    description:
      'Atualiza estoque, custo médio e contas a pagar em uma operação.',
  },
  {
    key: 'financial_email_alerts',
    label: 'Alertas financeiros por e-mail',
    group: 'Financeiro',
    description: 'Envia avisos de vencimentos, divergências e margens.',
  },
];

export const MARKET_FEATURE_KEYS = MARKET_FEATURES.map(
  (feature) => feature.key,
);

export const hasMarketFeature = (user, feature) =>
  user?.role === 'super_admin' ||
  (user?.enabled_features || []).includes(feature);
