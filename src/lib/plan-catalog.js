// Shared commercial definitions. Existing contracts without a catalog marker keep
// their configured permissions; applying a new model is an explicit admin action.
export const PLAN_MARKERS = [
  "catalog:essencial",
  "catalog:profissional",
  "catalog:completo",
];
const baseModules = [
  "pdv",
  "estoque",
  "vendas",
  "relatorios",
  "financeiro",
  "usuarios",
  "configuracoes",
];
const baseFeatures = [
  "market_logo",
  "sidebar_customization",
  "product_image_upload",
];
const professionalFeatures = [
  "simultaneous_sales",
  "advanced_stock",
  "advanced_reports",
  "advanced_finance",
  "report_export",
  "quick_product_creation",
];
const completeFeatures = [
  "cash_management",
  "integrated_purchases",
  "recurring_finance",
  "stock_email_alerts",
  "automatic_image_search",
  "advanced_permissions",
  "financial_email_alerts",
  "email_sending",
  "email_branding",
];

export const PLAN_CATALOG = [
  {
    key: "essencial",
    name: "Essencial",
    monthly_price: 29.9,
    user_limit: 1,
    description: "Para quem está começando e quer vender com organização.",
    enabled_modules: baseModules,
    enabled_features: [...baseFeatures, "catalog:essencial"],
  },
  {
    key: "profissional",
    name: "Profissional",
    monthly_price: 59.9,
    user_limit: 5,
    description: "Para quem quer atender mais rápido e administrar melhor.",
    enabled_modules: [...baseModules, "fiados"],
    enabled_features: [
      ...baseFeatures,
      ...professionalFeatures,
      "catalog:profissional",
    ],
  },
  {
    key: "completo",
    name: "Completo",
    monthly_price: 99.9,
    user_limit: 15,
    description: "Para quem quer controle total e mais automação.",
    enabled_modules: [...baseModules, "fiados", "caixas", "auditoria"],
    enabled_features: [
      ...baseFeatures,
      ...professionalFeatures,
      ...completeFeatures,
      "catalog:completo",
    ],
  },
];

export const COMMERCIAL_FEATURES = [
  ...professionalFeatures,
  "cash_management",
  "advanced_permissions",
];

/** @param {any} user */
export function catalogPlan(user) {
  if (!Array.isArray(user?.enabled_features)) return undefined;
  return PLAN_CATALOG.find((plan) =>
    (user?.enabled_features || []).includes(`catalog:${plan.key}`),
  );
}

/** @param {any} user @param {string} feature */
export function hasPlanFeature(user, feature) {
  if (user?.role === "super_admin") return true;
  if (!user) return false;
  const plan = catalogPlan(user);
  return plan ? plan.enabled_features.includes(feature) : true;
}

/** @param {string} key */
export function planTemplate(key) {
  const plan = PLAN_CATALOG.find((item) => item.key === key);
  if (!plan) throw new Error("Modelo de plano inválido.");
  return {
    name: plan.name,
    description: plan.description,
    monthly_price: plan.monthly_price,
    user_limit: plan.user_limit,
    trial_days: 0,
    product_limit: null,
    unit_limit: 1,
    enabled_modules: [...plan.enabled_modules],
    enabled_features: [...plan.enabled_features],
    active: true,
  };
}

/** @param {any} source */
export function catalogConfigurationError(source) {
  if (
    source.enabled_features !== undefined &&
    !Array.isArray(source.enabled_features)
  )
    return "Recursos inválidos.";
  const markers = (source.enabled_features || []).filter((key) =>
    PLAN_MARKERS.includes(key),
  );
  if (!markers.length) return "";
  if (markers.length !== 1) return "Selecione apenas um modelo comercial.";
  const plan = catalogPlan(source);
  if (!Array.isArray(source.enabled_modules)) return "Módulos inválidos.";
  if (
    !plan ||
    Number(source.user_limit) !== plan.user_limit ||
    Number(source.monthly_price) !== plan.monthly_price ||
    source.name !== plan.name
  )
    return "Nome, preço e limite devem corresponder ao modelo comercial selecionado.";
  for (const field of ["enabled_modules", "enabled_features"]) {
    if (
      JSON.stringify([...source[field]].sort()) !==
      JSON.stringify([...plan[field]].sort())
    )
      return "Os recursos devem corresponder ao modelo comercial selecionado.";
  }
  return "";
}

// Used by the navigation and API so a hidden tab cannot bypass the entitlement.
/** @param {any} user @param {string} section */
export function canUseFinanceSection(user, section) {
  const advanced = [
    "payables",
    "receivables",
    "cashflow",
    "ledger",
    "accounts",
    "suppliers",
    "reports",
    "history",
    "settings",
  ];
  if (["results", "goals", "reconciliation", "permissions"].includes(section))
    return hasPlanFeature(user, "advanced_permissions");
  if (["purchases", "products"].includes(section))
    return !catalogPlan(user) || catalogPlan(user).key === "completo";
  if (section === "recurring")
    return !catalogPlan(user) || catalogPlan(user).key === "completo";
  return (
    !advanced.includes(section) || hasPlanFeature(user, "advanced_finance")
  );
}
