import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = new URL('../', import.meta.url);

async function walk(directory) {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const file = path.posix.join(directory, entry.name);
    return entry.isDirectory() ? walk(`${file}/`) : [file];
  }));
  return nested.flat();
}

const files = (await walk('src/')).filter((file) => /\.(jsx|js)$/.test(file));
const failures = [];

for (const file of files) {
  const source = await readFile(new URL(file, root), 'utf8');
  const jsxTags = source.match(/<[^>]+>/gs) || [];

  for (const tag of jsxTags) {
    if (/^<form\b/.test(tag) && !/\bonSubmit=/.test(tag)) {
      failures.push(`${file}: form sem onSubmit -> ${tag.slice(0, 120)}`);
    }
    if (/^<a\b/.test(tag) && /\btarget=/.test(tag) && !/\brel=/.test(tag)) {
      failures.push(`${file}: link externo sem rel -> ${tag.slice(0, 120)}`);
    }
    if (/\bhref=(["'])#\1/.test(tag) || /\bhref=\{(["'])#\1\}/.test(tag)) {
      failures.push(`${file}: link morto href="#" -> ${tag.slice(0, 120)}`);
    }
    if (/\bhref=(["'])\1/.test(tag) || /\bhref=\{(["'])\1\}/.test(tag)) {
      failures.push(`${file}: link sem destino -> ${tag.slice(0, 120)}`);
    }
  }

  assert.doesNotMatch(
    source,
    /jsonb_build_object\('status',\$\{requestedStatus\}\)/,
    `${file}: status sem cast no log de mercado causa erro 42P18.`,
  );
}

assert.deepEqual(failures, [], failures.join('\n'));

console.log('Teste da superficie interativa aprovado.');
