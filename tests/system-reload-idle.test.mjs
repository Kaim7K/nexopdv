import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../src/components/SystemReloadWatcher.jsx', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default function', 'function');
let now = 1_000_000;
let calls = 0;
let token = 'initial';
let tick;
let reload;
let cleanup;
const events = new Map();
const stored = new Map();
const document = { visibilityState: 'visible', hasFocus: () => true,
  addEventListener: (name, fn) => events.set(name, fn),
  removeEventListener: (name) => events.delete(name) };
const window = { ...document,
  setInterval: fn => { tick = fn; return 1; }, clearInterval: () => {},
  setTimeout: fn => { reload = fn; return 2; }, clearTimeout: () => {},
  sessionStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) },
  location: { reload: () => {} } };
const run = new Function('useCallback', 'useEffect', 'useRef', 'useAuth', 'nexoApi', 'window', 'document', 'Date',
  `${source}\nSystemReloadWatcher();`);
run(fn => fn, fn => { cleanup = fn(); }, value => ({ current: value }), () => ({ user: { id: '1' } }),
  { system: { reloadStatus: async () => { calls++; return { reload_token: token }; } } },
  window, document, { now: () => now });
const settle = () => new Promise(resolve => setImmediate(resolve));
await settle();
assert.equal(calls, 1, 'Check once on mount');
events.get('focus')(); events.get('pointerdown')(); events.get('keydown')();
await settle();
assert.equal(calls, 1, 'Activity bursts must not multiply database requests');
now += 60_000; tick(); await settle();
assert.equal(calls, 2, 'Continue checking while recently active');
now += 120_000; tick(); await settle();
assert.equal(calls, 2, 'Idle visible tabs must stop polling');
document.visibilityState = 'hidden';
events.get('pointerdown')(); tick(); await settle();
assert.equal(calls, 2, 'Hidden tabs must not query');
document.visibilityState = 'visible';
events.get('visibilitychange')(); await settle();
assert.equal(calls, 3, 'Resume on return');
now += 60_000;
document.hasFocus = () => false; tick(); await settle();
assert.equal(calls, 3, 'Unfocused windows must not query');
document.hasFocus = () => true;
token = 'changed'; events.get('focus')(); await settle();
assert.equal(calls, 4);
assert.equal(typeof reload, 'function', 'Administrator reload must still be scheduled');
cleanup();
assert.equal(events.size, 0, 'Remove activity listeners on unmount');
console.log('System reload idle behavior passed.');
