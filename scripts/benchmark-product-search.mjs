import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { searchProducts as baseline } from '../tests/fixtures/product-search-baseline.mjs';
import { searchProducts as optimized } from '../src/lib/pdv.js';

const catalog = Array.from({ length: 1200 }, (_, index) => ({
  id: `product-${index}`, name: `${['Café Torrado', 'Arroz Branco', 'Leite Integral', 'Sabão em pó', 'Água Mineral', 'Biscoito'][index % 6]} ${index % 25} 500g`,
  category: ['Mercearia', 'Bebidas', 'Limpeza'][index % 3], barcode: `789${String(index).padStart(10, '0')}`, internal_code: `INT-${index}`, sales_count: index % 11,
}));
const queries = ['cafe', 'cafe torrdo', 'aroz', 'leiti integral', 'sbao po', 'água minral', 'biscito', 'merceria', 'INT-123', '7890000000123', '500g', 'produto inexistente'];
for (const query of queries) assert.deepEqual(optimized(catalog, query), baseline(catalog, query));
function sample(search) {
  const start = performance.now();
  for (const query of queries) search(catalog, query);
  return performance.now() - start;
}
sample(baseline); sample(optimized);
const samples = { baseline: [], optimized: [] };
for (let index = 0; index < 7; index++) {
  // Alternate execution order to reduce bias from warmup and system load.
  for (const [name, search] of index % 2 ? [['optimized', optimized], ['baseline', baseline]] : [['baseline', baseline], ['optimized', optimized]]) samples[name].push(sample(search));
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const result = { products: catalog.length, queries: queries.length, samples, baselineMedianMs: median(samples.baseline), optimizedMedianMs: median(samples.optimized) };
result.reductionPercent = (1 - result.optimizedMedianMs / result.baselineMedianMs) * 100;
await mkdir('artifacts/refactor/search', { recursive: true });
await writeFile('artifacts/refactor/search/benchmark.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
