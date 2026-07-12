import assert from 'node:assert/strict';
import { analyzeStockReplenishment, buildStockAlertEmail } from '../server/stock-alerts.js';

const now = new Date('2026-07-12T20:00:00.000Z');
const sales = Array.from({ length:30 }, (_, index) => ({
  status:'concluida', created_date:new Date(now.getTime() - index * 86_400_000).toISOString(),
  items:[{ product_id:'frequent', quantity:10, unit:'unidade' }],
}));
const products = [
  { id:'zero', name:'Sem estoque', quantity:0, status:'ativo', track_stock:true },
  { id:'frequent', name:'Muito vendido', quantity:12, status:'ativo', track_stock:true, updated_date:now.toISOString() },
  { id:'ignored', name:'Sem controle', quantity:0, status:'ativo', track_stock:false },
  { id:'inactive', name:'Inativo', quantity:0, status:'inativo', track_stock:true },
];
const report = analyzeStockReplenishment(products, sales, now);
assert.equal(report.find(item => item.id === 'zero')?.priority, 'Esgotado');
assert.equal(report.find(item => item.id === 'frequent')?.priority, 'Crítico');
assert(!report.some(item => item.id === 'ignored' || item.id === 'inactive'));
assert.equal(report.find(item => item.id === 'frequent')?.sold30, 300);
const email = buildStockAlertEmail({ marketName:'Mercado Teste', products:report, generatedAt:now.toISOString() });
assert.match(email.subject, /Mercado Teste/);
assert.match(email.html, /Muito vendido/);
console.log('Teste de alertas de estoque aprovado.');
