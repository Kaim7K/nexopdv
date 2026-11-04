import assert from 'node:assert/strict';
import test from 'node:test';
import * as baseline from './fixtures/product-search-baseline.mjs';
import { getProductSearchScore, searchProducts } from '../src/lib/pdv.js';

export const products = Array.from({ length: 160 }, (_, index) => ({
  id: `product-${index}`,
  name: ['Café Torrado', 'Arroz Tipo', 'Leite Integral', 'Sabão em pó', 'Pão francês', 'Açúcar Cristal', 'Água Mineral', 'Chocolate'][index % 8] + ` ${index % 17} ${index % 2 ? '500g' : '1kg'}`,
  category: ['Mercearia', 'Limpeza', 'Padaria', 'Bebidas'][index % 4],
  barcode: `789${String(index).padStart(10, '0')}`,
  internal_code: `INT-${index}`,
  sales_count: index % 7 ? String(index % 19) : null,
  sale_price: 4.5,
}));
products.push({ id: 'missing' }, { id: 'empty', name: null, category: '', barcode: 12345, internal_code: 0 });

const queries = ['', ' ', null, 0, 789, 'café', 'CAFE', 'cafe torrdo', 'aroz', 'leiti', 'sbao po', 'pao frances', 'açúcar', 'água mineral', 'choclate', 'merceria', 'bebidas', 'INT-12', 'int 12', '7890000000012', '0000000012', '500g', '1kg', 'Café 2', 'limpeza 500', 'produto inexistente', '!!!', '  pão--francês  ', 'a'.repeat(120)];

test('search scores and ordered results match checkpoint 39a34af', () => {
  for (const query of queries) {
    for (const product of products) assert.equal(getProductSearchScore(product, query), baseline.getProductSearchScore(product, query), `${product.id}: ${query}`);
    for (const limit of [0, 1, 10, 100, 300, -1]) {
      const result = searchProducts(products, query, { limit });
      assert.deepEqual(result, baseline.searchProducts(products, query, { limit }), `query=${query}, limit=${limit}`);
      for (const product of result) assert.equal(product, products.find(item => item.id === product.id));
    }
  }
});

test('search reflects edited names, codes, categories and sales counts without a stale index', () => {
  const product = { ...products[0] };
  const other = { ...products[8] };
  const catalog = [product, other];
  for (const edits of [
    { name: 'Banana prata' }, { internal_code: 'BAN-001', barcode: '001234' },
    { category: 'Hortifruti', sales_count: 99 }, { name: 'Café Torrado 8 1kg', sales_count: 0 },
  ]) {
    Object.assign(product, edits);
    for (const query of ['banana', '001234', 'ban 001', 'hortifruti', 'cafe']) assert.deepEqual(searchProducts(catalog, query), baseline.searchProducts(catalog, query));
  }
});

test('search does not change catalog order or product fields', () => {
  const catalog = Object.freeze(products.map(item => Object.freeze({ ...item })));
  const before = JSON.stringify(catalog);
  for (const query of queries) searchProducts(catalog, query);
  assert.equal(JSON.stringify(catalog), before);
});
