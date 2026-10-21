import assert from 'node:assert/strict';
import { productDuplicateMessage, similarProductNames } from '../src/lib/product-duplicates.js';

assert.ok(similarProductNames('Café Torrado 500 g', 'cafe torrado 500g'));
assert.ok(similarProductNames('Arroz Branco', 'Arroz Brancoo'));
assert.ok(!similarProductNames('Café 500g', 'Café 1kg'));
assert.ok(!similarProductNames('Leite Integral', 'Leite Desnatado'));
assert.ok(!similarProductNames('', ''));
const products = [{ id: 'one', name: 'Café torrado', barcode: '123456' }];
assert.ok(productDuplicateMessage({ name: 'Outro produto', barcode: '123456' }, products));
assert.ok(productDuplicateMessage({ name: 'Cafe torrado', barcode: '' }, products));
assert.equal(productDuplicateMessage({ name: 'Cafe torrado', barcode: '654321' }, products), '');
assert.ok(productDuplicateMessage({ name: 'Cafe torrado', barcode: '654321' }, [{ ...products[0], barcode: '' }]));
assert.equal(productDuplicateMessage(products[0], products, 'one'), '');
console.log('Product duplicate checks passed.');
