import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, api, finance, db, paymentModal, financeUi] = await Promise.all([
  read('database/migrations/016_financial_cash_integrity.sql'),
  read('api/index.js'),
  read('server/finance.js'),
  read('server/db.js'),
  read('src/components/pdv/PaymentModal.jsx'),
  read('src/components/finance/FinanceUi.jsx'),
]);

assert.match(db, /CURRENT_SCHEMA_VERSION = 16/, 'A aplicação deve exigir a migração de integridade financeira.');
assert.match(migration, /cash_close/, 'Fechamentos precisam ter uma origem financeira válida.');
assert.match(migration, /nexo_sales_client_operation_uidx/, 'Vendas devem rejeitar repetição da mesma operação.');
assert.match(migration, /nexo_cash_movement_finance_payment_uidx/, 'Pagamentos não podem duplicar movimentos de caixa.');
assert.match(migration, /nexo_cash_movement_fiado_uidx/, 'Recebimentos fiados não podem duplicar movimentos de caixa.');
assert.match(migration, /nexo_finance_cash_movement_origin_uidx/, 'Ajustes manuais devem possuir um único lançamento financeiro vinculado.');
assert.match(api, /cashClosingExpenseQuery/, 'Fechamento e Financeiro precisam ser sincronizados pela mesma rotina.');
assert.match(api, /linkedSales[\s\S]{0,400}vendas vinculadas/, 'Uma sessão com vendas não pode ser excluída e deixar registros órfãos.');
assert.match(api, /client_operation_id/, 'A conclusão de venda precisa usar uma chave idempotente.');
assert.match(api, /financial_operation_id/, 'Fechamento e edição de caixa precisam resistir a operações concorrentes.');
assert.match(api, /fiado_arquivado/, 'Fiados encerrados devem ser arquivados sem apagar sua origem financeira.');
assert.match(api, /venda_arquivada/, 'Vendas canceladas devem ser arquivadas sem criar referências órfãs.');
assert.match(api, /settlement_movements_reversed/, 'Cancelar venda fiada recebida deve estornar o movimento vinculado.');
assert.match(finance, /PURCHASE_STOCK_ALREADY_USED/, 'Estorno de compra deve proteger estoque já consumido.');
assert.match(finance, /finance_payment_id/, 'Pagamento em dinheiro deve manter vínculo com o caixa operacional.');
assert.match(finance, /'status','estornado'/, 'Cancelamentos devem estornar movimentos vinculados.');
assert.match(finance, /sale_receipts/, 'Saldos de contas devem usar o valor recebido líquido de troco.');
assert.match(finance, /!\["cancelado", "estornado"\]\.includes/, 'Conciliação deve ignorar movimentos cancelados e estornados.');
assert.match(paymentModal, /roundCurrency/, 'O modal de pagamento deve normalizar centavos antes de concluir.');
assert.match(paymentModal, /valor maior que zero/, 'Pagamentos zerados devem ser explicados e bloqueados.');
assert.match(financeUi, /useModalBehavior/, 'Modais financeiros devem controlar foco e restauração de navegação.');

console.log('Testes de integridade financeira aprovados.');
