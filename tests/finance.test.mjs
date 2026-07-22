import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("database/migrations/013_financial_management.sql");
const service = read("server/finance.js");
const api = read("api/index.js");
const client = read("src/api/nexoApi.js");
const page = read("src/pages/Financeiro.jsx");
const app = read("src/App.jsx");
const layout = read("src/components/Layout.jsx");
const navigation = read("src/config/navigation.jsx");

for (const table of [
  "finance_categories",
  "finance_accounts",
  "finance_suppliers",
  "finance_recurring_rules",
  "finance_transactions",
  "finance_payments",
  "finance_transaction_events",
  "finance_purchases",
  "finance_purchase_items",
  "finance_goals",
  "finance_settings",
  "finance_user_permissions",
]) {
  assert.match(
    migration,
    new RegExp(`CREATE TABLE IF NOT EXISTS nexo\\.${table}`),
    `Migração financeira sem ${table}.`,
  );
}
assert.match(
  migration,
  /market_id uuid NOT NULL REFERENCES nexo\.markets/,
  "Entidades financeiras precisam ser isoladas por mercadinho.",
);
assert.match(
  migration,
  /ON DELETE RESTRICT/,
  "Pagamentos e itens de compra não podem perder o histórico por exclusão em cascata.",
);
assert.match(
  migration,
  /finance_transaction_events/,
  "Histórico auditável de lançamentos é obrigatório.",
);
assert.match(
  service,
  /status=\$\{status\},cancelled_by=/,
  "Cancelamento deve preservar o lançamento original.",
);
assert.match(
  service,
  /type === "transfer"/,
  "Transferências precisam ser tratadas separadamente de receitas e despesas.",
);
assert.match(
  service,
  /item\.unit_cost \?\? currentProduct\?\.cost_price/,
  "Lucro deve usar o custo histórico com fallback rastreável.",
);
assert.match(
  service,
  /requirePermission\(permissions, "view"\)/,
  "A API financeira precisa validar permissão de acesso.",
);
assert.match(
  service,
  /transaction\.market_id=\$\{marketId\}/,
  "Consultas financeiras precisam restringir o mercadinho.",
);
assert.match(
  service,
  /created_from_purchase/,
  "Compra confirmada deve gerar lançamentos auditáveis.",
);
assert.match(
  api,
  /path\[0\]\s*===\s*'finance'[\s\S]{0,40}\?\s*'financeiro'/,
  "Módulo financeiro deve respeitar o plano contratado.",
);
assert.match(
  client,
  /finance:\s*\{/,
  "Cliente precisa expor a API financeira integrada.",
);
assert.match(app, /PRIVATE_ROUTES/, "Rotas privadas devem vir do mapa compartilhado.");
assert.match(navigation, /path: '\/financeiro'/, "Rota financeira ausente.");
assert.match(layout, /MENU_ITEMS/, "Layout deve consumir o menu compartilhado.");
assert.match(navigation, /label: 'Financeiro'/, "Navegacao financeira ausente.");
assert.match(
  page,
  /PRIMARY_NAV_KEYS/,
  "A navegação financeira deve priorizar as tarefas mais frequentes.",
);
assert.match(
  page,
  /Mais opções/,
  "Recursos financeiros avançados devem usar divulgação progressiva.",
);
assert.match(
  page,
  /O que você quer fazer\?/,
  "O resumo financeiro deve oferecer ações rápidas orientadas por tarefa.",
);
assert.match(
  page,
  /Ver análises detalhadas/,
  "Indicadores avançados não devem sobrecarregar o resumo inicial.",
);
for (const label of [
  "Visão geral",
  "Movimentações",
  "Despesas",
  "Receitas",
  "Contas a pagar",
  "Contas a receber",
  "Fluxo de caixa",
  "Resultados",
  "Compras",
  "Fornecedores",
  "Contas financeiras",
  "Conciliação",
  "Metas",
  "Relatórios",
  "Configurações",
]) {
  assert.ok(page.includes(label), `Tela financeira sem a seção ${label}.`);
}
assert.doesNotMatch(
  page,
  /mock|fake|placeholder permanente/i,
  "A área financeira não pode usar dados simulados.",
);

console.log("Teste da área financeira aprovado.");
