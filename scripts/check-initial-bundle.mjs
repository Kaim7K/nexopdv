import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
const visited = new Set();
function visit(key) {
  const entry = manifest[key];
  if (visited.has(entry.file)) return;
  visited.add(entry.file);
  for (const dependency of entry.imports || []) visit(dependency);
}
const entryKey = Object.keys(manifest).find(key => manifest[key].isEntry);
assert.ok(entryKey, 'Build the application before checking its initial bundle.');
visit(entryKey);
const files = await Promise.all([...visited].filter(file => file.endsWith('.js')).map(async file => ({ file, bytes: (await stat(`dist/${file}`)).size })));
for (const { file } of files) assert.doesNotMatch(file, /\/(charts|pdf|dnd|xlsx)-/, 'Feature libraries must stay outside the initial static imports.');
const bytes = files.reduce((total, file) => total + file.bytes, 0);
await mkdir('artifacts/refactor/bundle', { recursive: true });
await writeFile('artifacts/refactor/bundle/initial-bundle.json', JSON.stringify({ bytes, files }, null, 2));
console.log(`Initial static JavaScript: ${bytes} bytes before compression. Heavy feature libraries remain deferred.`);
