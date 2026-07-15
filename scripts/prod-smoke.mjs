const baseUrl = process.argv[2] || 'https://nexopdv-gold.vercel.app';

async function request(path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    redirect: 'manual',
    ...options,
    headers: {
      Accept: 'application/json,text/html,*/*',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');
  return { response, body };
}

function assertStatus(label, status, allowed) {
  if (!allowed.includes(status)) {
    throw new Error(`${label}: status ${status}; esperado ${allowed.join(' ou ')}`);
  }
}

const checks = [];

const home = await request('/');
assertStatus('GET /', home.response.status, [200]);
if (!String(home.body).includes('id="root"')) {
  throw new Error('GET /: HTML sem #root');
}
checks.push('landing HTML');

const assets = [
  ...String(home.body).matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
].map((match) => match[1]);
for (const asset of assets) {
  const result = await request(asset);
  assertStatus(`asset ${asset}`, result.response.status, [200]);
}
checks.push(`${assets.length} assets JS/CSS`);

for (const [label, path] of [
  ['manifest', '/manifest.json'],
  ['robots', '/robots.txt'],
  ['preview PDV', '/landing/pdv-preview.png'],
  ['preview estoque', '/landing/estoque-preview.png'],
  ['preview relatorios', '/landing/relatorios-preview.png'],
]) {
  const result = await request(path);
  assertStatus(label, result.response.status, [200]);
}
checks.push('assets públicos');

const health = await request('/api/health');
assertStatus('GET /api/health', health.response.status, [200]);
if (!health.body?.ok) throw new Error('GET /api/health: resposta sem ok=true');
checks.push('health');

for (const [label, path, options, allowed] of [
  ['GET /api/auth/me sem sessão', '/api/auth/me', {}, [401]],
  ['GET /api/markets sem sessão', '/api/markets', {}, [401]],
  [
    'POST /api/markets sem sessão',
    '/api/markets',
    { method: 'POST', body: JSON.stringify({}) },
    [401],
  ],
  [
    'POST /api/auth/login inválido',
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid@example.com', password: 'invalid' }),
    },
    [400, 401],
  ],
]) {
  const result = await request(path, options);
  assertStatus(label, result.response.status, allowed);
}
checks.push('APIs sem sessão');

console.log(`Smoke de produção aprovado em ${baseUrl}: ${checks.join(', ')}.`);
