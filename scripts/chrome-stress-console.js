/*
  Nexo PDV - Chrome console stress command

  How to use:
  1. Open https://nexopdv-gold.vercel.app and login in the target market.
  2. Open Chrome DevTools > Console.
  3. Paste this whole file and press Enter.
  4. Type STRESSAR NEXO when asked.

  This creates real test data in the logged market. Use a test market when possible.
*/
(async () => {
  const STRESS = {
    products: 150,
    sales: 120,
    parallelSales: 5,
    maxItemsPerSale: 6,
    fiadoEvery: 8,
    openCash: true,
    closeCashAtEnd: false,
    loadScreens: true,
    screenMode: 'fetch',
    roleTests: true,
    planTests: true,
    printTests: true,
    openPrintDialog: false,
    requestTimeoutMs: 90_000,
    ...(window.__NEXO_STRESS_CONFIG__ || {}),
  };

  const RUN_ID = `STRESS-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
  const TEST_PASSWORD = `NexoStress!${RUN_ID.slice(-6)}`;
  const startedAt = performance.now();
  const results = [];
  const created = { products: [], sales: [], fiados: [], finance: [], users: [], plans: [] };

  const money = (value) => Math.round(Number(value || 0) * 100) / 100;
  const pick = (list, index = Math.floor(Math.random() * list.length)) =>
    list[index % list.length];
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  function printBanner() {
    console.clear();
    console.log('%cNexo PDV stress test', 'font-size:18px;font-weight:900;color:#10b981');
    console.log('Run:', RUN_ID);
    console.log('Config:', STRESS);
    console.warn('ATENCAO: este comando cria produtos, vendas, fiados, caixa e lancamentos de teste reais no mercado logado.');
  }

  function pushResult(step, ok, details = '') {
    const row = {
      step,
      ok,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      at: new Date().toISOString(),
    };
    results.push(row);
    const color = ok ? '#10b981' : '#ef4444';
    console.log(`%c${ok ? 'OK' : 'FALHA'}%c ${step}`, `color:${color};font-weight:900`, 'color:inherit', details || '');
    return row;
  }

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || STRESS.requestTimeoutMs);
    const method = options.method || (options.body ? 'POST' : 'GET');
    try {
      const response = await fetch(`/api${path}`, {
        method,
        credentials: 'include',
        headers: options.body
          ? { Accept: 'application/json', 'Content-Type': 'application/json' }
          : { Accept: 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
      if (!response.ok) {
        const error = new Error(data.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        error.path = path;
        throw error;
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function rawApi(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || STRESS.requestTimeoutMs);
    const method = options.method || (options.body ? 'POST' : 'GET');
    try {
      const response = await fetch(`/api${path}`, {
        method,
        credentials: 'include',
        headers: options.body
          ? { Accept: 'application/json', 'Content-Type': 'application/json' }
          : { Accept: 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
      return { ok: response.ok, status: response.status, data };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function optional(step, fn) {
    try {
      const data = await fn();
      pushResult(step, true, summarize(data));
      return data;
    } catch (error) {
      pushResult(step, false, `${error.status || error.name || 'ERR'} - ${error.message}`);
      return null;
    }
  }

  function summarize(data) {
    if (Array.isArray(data)) return `${data.length} item(ns)`;
    if (!data || typeof data !== 'object') return String(data ?? '');
    if (data.items) return `${data.items.length} item(ns), total ${data.total ?? data.items.length}`;
    if (data.updated !== undefined) return data;
    if (data.id) return `id ${data.id}`;
    if (data.ok !== undefined) return data;
    return Object.fromEntries(Object.entries(data).slice(0, 6));
  }

  async function expectStatus(step, path, options, expectedStatuses) {
    const expected = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
    try {
      const response = await rawApi(path, options);
      const ok = expected.includes(response.status);
      pushResult(step, ok, `HTTP ${response.status}; esperado ${expected.join('/')}; ${response.data?.message || response.data?.code || ''}`);
      return response;
    } catch (error) {
      pushResult(step, false, `${error.name || 'ERR'} - ${error.message}`);
      return null;
    }
  }

  async function loginAs(email, password, label) {
    const login = await rawApi('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (!login.ok) {
      pushResult(`login ${label}`, false, `HTTP ${login.status}; ${login.data?.message || ''}`);
      return null;
    }
    const me = await api('/auth/me');
    pushResult(`login ${label}`, true, `${me.email} / ${me.role}`);
    return me;
  }

  async function createTestUser(role, label) {
    const safeRun = RUN_ID.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-16);
    const email = `stress+${safeRun}.${label}.${role}@nexo.invalid`;
    const user = await optional(`criar usuario ${role} ${label}`, () =>
      api('/users', {
        method: 'POST',
        body: {
          email,
          password: TEST_PASSWORD,
          full_name: `${RUN_ID} ${label} ${role}`,
          role,
        },
      }),
    );
    if (user?.id) {
      const record = { ...user, email, password: TEST_PASSWORD, role };
      created.users.push(record);
      return record;
    }
    return null;
  }

  function buildProducts() {
    const categories = ['Mercearia', 'Bebidas', 'Hortifruti', 'Limpeza', 'Padaria', 'Acougue', 'Laticinios'];
    const names = ['Arroz', 'Feijao', 'Cafe', 'Leite', 'Macarrao', 'Acucar', 'Oleo', 'Sabonete', 'Detergente', 'Banana'];
    const runDigits = String(Date.now()).slice(-6);
    return Array.from({ length: STRESS.products }, (_, index) => {
      const n = index + 1;
      const unit = n % 9 === 0 ? 'peso' : n % 7 === 0 ? 'pacote' : 'unidade';
      const sale = money(2.5 + (n % 37) * 1.73);
      return {
        name: `${RUN_ID} ${pick(names, n)} ${String(n).padStart(4, '0')}`,
        category: pick(categories, n),
        barcode: `789${runDigits}${String(n).padStart(4, '0')}`,
        internal_code: `${RUN_ID}-${String(n).padStart(4, '0')}`,
        image_url: '',
        sale_price: sale,
        cost_price: money(sale * 0.58),
        quantity: unit === 'peso' ? 500 : 900 + (n % 70),
        unit,
        status: 'ativo',
        allow_pdv_price_edit: n % 11 === 0,
        track_stock: true,
      };
    });
  }

  function salePayload(products, index) {
    const itemCount = 1 + (index % STRESS.maxItemsPerSale);
    const selected = Array.from({ length: itemCount }, (_, itemIndex) =>
      products[(index * 7 + itemIndex * 13) % products.length],
    );
    const items = selected.map((product, itemIndex) => {
      const unit = product.unit === 'peso' ? 'peso' : product.unit || 'unidade';
      const quantity = unit === 'peso' ? null : 1 + ((index + itemIndex) % 4);
      const weight = unit === 'peso' ? money(0.25 + ((index + itemIndex) % 5) * 0.37) : null;
      return {
        product_id: product.id,
        quantity,
        weight,
        unit_price: Number(product.sale_price || 0),
      };
    });
    const total = money(
      items.reduce((sum, item) => {
        const qty = item.weight ?? item.quantity ?? 1;
        return sum + money(qty * item.unit_price);
      }, 0),
    );
    const isFiado = STRESS.fiadoEvery > 0 && index % STRESS.fiadoEvery === 0;
    const method = pick(['dinheiro', 'pix', 'debito', 'credito', 'outros'], index);
    return {
      items,
      payments: isFiado
        ? [{ method: 'fiado', amount: total }]
        : [{ method, amount: money(total + 1) }],
      discount_type: 'valor',
      discount_value: 0,
      observation: `${RUN_ID} venda automatizada ${index}`,
      sale_type: isFiado ? 'fiado' : 'normal',
      fiado: isFiado
        ? {
            responsible_name: `${RUN_ID} Cliente ${index}`,
            phone: `(71) 9${String(90000000 + index).slice(0, 8)}`,
            observation: 'Fiado gerado pelo teste de stress',
          }
        : undefined,
    };
  }

  function pdvDraftPayload(product) {
    const unit = product.unit === 'peso' ? 'peso' : product.unit || 'unidade';
    const qty = unit === 'peso' ? 0.35 : 2;
    return {
      items: [{
        product_id: product.id,
        product_name: product.name,
        barcode: product.barcode || '',
        internal_code: product.internal_code || '',
        quantity: unit === 'peso' ? 1 : qty,
        weight: unit === 'peso' ? qty : null,
        unit_price: Number(product.sale_price || 0),
        subtotal: money(qty * Number(product.sale_price || 0)),
        unit,
        allow_pdv_price_edit: Boolean(product.allow_pdv_price_edit),
      }],
      payments: [],
      discount_value: 0,
      discount_type: 'valor',
      observation: `${RUN_ID} rascunho PDV`,
      sale_type: 'normal',
    };
  }

  async function runPool(total, concurrency, worker) {
    let next = 0;
    const out = [];
    async function runner() {
      while (next < total) {
        const index = ++next;
        out[index - 1] = await worker(index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, runner));
    return out;
  }

  async function fetchScreen(route, viewport, reason = 'modo fetch') {
    const url = `${route}${route.includes('?') ? '&' : '?'}stress=${encodeURIComponent(RUN_ID)}&vp=${viewport}`;
    const response = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'text/html' },
    });
    const html = await response.text();
    const hasRoot = /<div[^>]+id=["']root["']/i.test(html);
    const hasBundle =
      /<script\b[^>]*\btype=["']module["'][^>]*>/i.test(html) &&
      /<script\b[^>]*\bsrc=["'][^"']*(?:\/assets\/|\/src\/)[^"']+\.js(?:\?[^"']*)?["'][^>]*>/i.test(html);
    const hasBuiltAsset =
      hasBundle ||
      /<link\b[^>]*\bhref=["'][^"']*\/assets\/[^"']+\.(?:js|css)(?:\?[^"']*)?["'][^>]*>/i.test(html);
    return {
      route,
      viewport,
      ok: response.ok && hasRoot && hasBuiltAsset,
      detail: `HTTP ${response.status}, html ${html.length}, root ${hasRoot}, bundle ${hasBuiltAsset}, ${reason}`,
    };
  }

  async function loadScreen(route, viewport) {
    if (STRESS.screenMode !== 'popup') return fetchScreen(route, viewport);

    return new Promise((resolve) => {
      const width = viewport === 'mobile' ? 390 : 1366;
      const height = viewport === 'mobile' ? 844 : 768;
      const popup = window.open(
        `${route}${route.includes('?') ? '&' : '?'}stress=${encodeURIComponent(RUN_ID)}&vp=${viewport}`,
        `nexo_stress_${viewport}_${route.replace(/\W/g, '_')}`,
        `popup=yes,width=${width},height=${height},left=40,top=40`,
      );
      if (!popup) {
        fetchScreen(route, viewport, 'popup bloqueado; fallback fetch')
          .then(resolve)
          .catch((error) =>
            resolve({ route, viewport, ok: false, detail: `popup bloqueado e fallback falhou: ${error.message}` }),
          );
        return;
      }
      const started = Date.now();
      const inspect = () => {
        try {
          const doc = popup.document;
          const root = doc?.querySelector('#root');
          const text = String(root?.innerText || doc?.body?.innerText || '').trim();
          const interactive = doc?.querySelectorAll('button,[role="button"],a,input,select,textarea').length || 0;
          const ready = root && (root.childElementCount > 0 || text.length > 20 || interactive > 0);
          if (ready || Date.now() - started > 18_000) {
            const htmlLength = doc?.documentElement?.outerHTML?.length || 0;
            popup.close();
            resolve({
              route,
              viewport,
              ok: Boolean(ready),
              detail: `${text.length} chars, ${interactive} interativos, html ${htmlLength}, modo popup`,
            });
          } else {
            setTimeout(inspect, 500);
          }
        } catch (error) {
          try {
            popup.close();
          } catch {}
          fetchScreen(route, viewport, `popup falhou (${error.message}); fallback fetch`)
            .then(resolve)
            .catch((fallbackError) =>
              resolve({ route, viewport, ok: false, detail: `${error.message}; fallback falhou: ${fallbackError.message}` }),
            );
        }
      };
      setTimeout(inspect, 1000);
    });
  }

  async function ensureOpenCashForCurrentUser(label) {
    const state = await optional(`consultar caixa ${label}`, () => api('/cash/current'));
    if (!state || state.session) return state;
    return optional(`abrir caixa ${label}`, () =>
      api('/cash/open', {
        method: 'POST',
        body: { opening_amount: 100 },
      }),
    );
  }

  async function runPlanTests(currentUser) {
    if (!STRESS.planTests) return;
    const list = await rawApi('/admin/plans');
    if (currentUser.role !== 'super_admin') {
      pushResult('planos bloqueados para admin de mercado', list.status === 403, `HTTP ${list.status}`);
      await expectStatus('mercados bloqueados para admin de mercado', '/markets', {}, 403);
      return;
    }
    pushResult('listar planos super admin', list.ok, `HTTP ${list.status}`);
    if (!list.ok) return;
    const modules = ['pdv', 'estoque', 'vendas', 'caixas', 'fiados', 'relatorios', 'financeiro', 'auditoria', 'usuarios', 'configuracoes'];
    const features = ['email_sending', 'email_branding', 'market_logo', 'sidebar_customization', 'automatic_image_search', 'product_image_upload', 'stock_email_alerts', 'quick_product_creation', 'report_export', 'recurring_finance', 'integrated_purchases', 'financial_email_alerts'];
    const plan = await optional('criar plano stress', () =>
      api('/admin/plans', {
        method: 'POST',
        body: {
          name: `${RUN_ID} Plano Teste`,
          description: 'Plano criado pelo stress test e removido ao final.',
          monthly_price: 199.9,
          trial_days: 7,
          user_limit: 20,
          product_limit: 5000,
          unit_limit: 3,
          enabled_modules: modules,
          enabled_features: features,
          active: true,
        },
      }),
    );
    if (!plan?.id) return;
    created.plans.push(plan);
    await optional('atualizar plano stress', () =>
      api(`/admin/plans/${plan.id}`, {
        method: 'PATCH',
        body: {
          ...plan,
          name: `${RUN_ID} Plano Teste Atualizado`,
          monthly_price: 219.9,
          enabled_modules: modules,
          enabled_features: features,
          active: false,
        },
      }),
    );
    await optional('excluir plano stress', () =>
      api(`/admin/plans/${plan.id}`, { method: 'DELETE' }),
    );
  }

  async function runRolePermissionTests(products) {
    if (!STRESS.roleTests) return null;
    const vendedorA = await createTestUser('vendedor', 'vendedor-a');
    const vendedorB = await createTestUser('vendedor', 'vendedor-b');
    const gerente = await createTestUser('gerente', 'gerente');
    const admin = await createTestUser('admin', 'admin');
    if (!vendedorA || !vendedorB || !gerente || !admin) {
      pushResult('testes de permissoes por perfil', false, 'Nao foi possivel criar todos os usuarios de teste.');
      return null;
    }

    const vendedorAMe = await loginAs(vendedorA.email, vendedorA.password, 'vendedor A');
    if (vendedorAMe) {
      await ensureOpenCashForCurrentUser('vendedor A');
      const saleA = await optional('venda como vendedor A', () =>
        api('/sales/complete', { method: 'POST', body: salePayload(products, 10001) }),
      );
      if (saleA?.id) created.sales.push(saleA);
      await expectStatus('vendedor nao acessa usuarios', '/entities/User?sort=full_name&limit=20', {}, 403);
      await expectStatus('vendedor nao acessa admin plataforma', '/admin/overview', {}, 403);
      const ownSales = await optional('vendedor lista apenas proprias vendas', () =>
        api('/sales/list?page=1&page_size=100&include_sellers=1'),
      );
      if (ownSales?.items) {
        const onlyOwn = ownSales.items.every((sale) => sale.seller_id === vendedorAMe.id);
        pushResult('filtro de vendas do vendedor A', onlyOwn, `${ownSales.items.length} venda(s) visiveis`);
      }
    }

    const vendedorBMe = await loginAs(vendedorB.email, vendedorB.password, 'vendedor B');
    if (vendedorBMe) {
      await ensureOpenCashForCurrentUser('vendedor B');
      const saleB = await optional('venda como vendedor B', () =>
        api('/sales/complete', { method: 'POST', body: salePayload(products, 10003) }),
      );
      if (saleB?.id) created.sales.push(saleB);
      const ownSales = await optional('vendedor B lista apenas proprias vendas', () =>
        api('/sales/list?page=1&page_size=100&include_sellers=1'),
      );
      if (ownSales?.items) {
        const onlyOwn = ownSales.items.every((sale) => sale.seller_id === vendedorBMe.id);
        pushResult('filtro de vendas do vendedor B', onlyOwn, `${ownSales.items.length} venda(s) visiveis`);
      }
    }

    const gerenteMe = await loginAs(gerente.email, gerente.password, 'gerente');
    if (gerenteMe) {
      await optional('gerente lista usuarios', () => api('/entities/User?sort=full_name&limit=200'));
      await optional('gerente cria vendedor', () =>
        api('/users', {
          method: 'POST',
          body: {
            email: `stress+${RUN_ID.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-16)}.gerente-cria-vendedor@nexo.invalid`,
            password: TEST_PASSWORD,
            full_name: `${RUN_ID} vendedor criado por gerente`,
            role: 'vendedor',
          },
        }),
      );
      await expectStatus('gerente nao cria admin', '/users', {
        method: 'POST',
        body: {
          email: `stress+${RUN_ID.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-16)}.gerente-cria-admin@nexo.invalid`,
          password: TEST_PASSWORD,
          full_name: `${RUN_ID} admin negado`,
          role: 'admin',
        },
      }, 403);
      await expectStatus('gerente nao zera dados', '/maintenance/reset', {
        method: 'POST',
        body: { target: 'audits', confirmation: 'ZERAR' },
      }, 403);
    }

    const adminMe = await loginAs(admin.email, admin.password, 'admin teste');
    if (adminMe) {
      await optional('admin lista usuarios', () => api('/entities/User?sort=full_name&limit=300'));
      await expectStatus('admin reset exige confirmacao correta', '/maintenance/reset', {
        method: 'POST',
        body: { target: 'audits', confirmation: 'NAO_ZERAR' },
      }, 400);
      await expectStatus('admin de mercado nao acessa planos plataforma', '/admin/plans', {}, 403);
    }
    return adminMe;
  }

  async function runPdvPrintAndSaveTests(currentUser, products, sampleSale) {
    if (!STRESS.printTests) return;
    const product = products[0];
    if (!product) {
      pushResult('pdv salvar rascunho local', false, 'Sem produto para montar rascunho.');
      return;
    }
    const draftKey = `nexo:pdv:draft:${currentUser.market_id || currentUser.id}`;
    const draft = {
      activeSale: pdvDraftPayload(product),
      minimizedSales: [],
      savedAt: new Date().toISOString(),
      lastActiveAt: Date.now(),
      inactiveSince: null,
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
      const ok = saved?.activeSale?.items?.[0]?.product_id === product.id;
      pushResult('pdv salvar rascunho local', ok, draftKey);
      localStorage.removeItem(draftKey);
    } catch (error) {
      pushResult('pdv salvar rascunho local', false, error.message);
    }

    const sale = sampleSale || {
      sale_number: RUN_ID,
      total: draft.activeSale.items[0].subtotal,
      items: draft.activeSale.items,
      payments: [{ method: 'dinheiro', amount: draft.activeSale.items[0].subtotal }],
    };
    const receiptHtml = `<!doctype html><html><head><title>Recibo ${sale.sale_number || RUN_ID}</title></head><body><h1>Nexo PDV</h1><p>Venda ${sale.sale_number || sale.id || RUN_ID}</p><p>Total: ${sale.total}</p></body></html>`;
    try {
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;left:-200vw;top:0;width:320px;height:480px;opacity:0;pointer-events:none;border:0';
      document.body.appendChild(frame);
      frame.contentDocument.open();
      frame.contentDocument.write(receiptHtml);
      frame.contentDocument.close();
      const hasPrint = typeof frame.contentWindow.print === 'function';
      if (STRESS.openPrintDialog && hasPrint) frame.contentWindow.print();
      frame.remove();
      pushResult('pdv impressao recibo', hasPrint, STRESS.openPrintDialog ? 'print chamado' : 'API de impressao disponivel; dialogo real desativado');
    } catch (error) {
      pushResult('pdv impressao recibo', false, error.message);
    }

    try {
      const blob = new Blob([receiptHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `recibo-${RUN_ID}.html`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      pushResult('pdv salvar recibo/download', true, anchor.download);
    } catch (error) {
      pushResult('pdv salvar recibo/download', false, error.message);
    }
  }

  async function main() {
    printBanner();
    if (location.origin !== 'https://nexopdv-gold.vercel.app' && !location.hostname.includes('localhost')) {
      console.warn('Voce esta em:', location.origin);
    }
    const confirmation = prompt(`Digite STRESSAR NEXO para criar carga de teste no mercado logado.\nRun: ${RUN_ID}`);
    if (confirmation !== 'STRESSAR NEXO') {
      console.warn('Teste cancelado.');
      return;
    }

    let me = await api('/auth/me');
    pushResult('sessao autenticada', true, `${me.email || me.full_name || me.id} / ${me.role}`);

    await optional('healthcheck', () => api('/health'));
    await runPlanTests(me);

    let cashState = await optional('consultar caixa atual', () => api('/cash/current'));
    if (STRESS.openCash && cashState && !cashState.session) {
      const opened = await optional('abrir caixa', () =>
        api('/cash/open', { method: 'POST', body: { opening_amount: 250 } }),
      );
      if (opened?.session) cashState = opened;
    }
    if (cashState?.session?.id) {
      await optional('movimento entrada caixa', () =>
        api(`/cash/${cashState.session.id}/movements`, {
          method: 'POST',
          body: { type: 'entrada', amount: 35.5, note: `${RUN_ID} entrada stress` },
        }),
      );
      await optional('movimento retirada caixa', () =>
        api(`/cash/${cashState.session.id}/movements`, {
          method: 'POST',
          body: { type: 'retirada', amount: 5.25, note: `${RUN_ID} retirada stress` },
        }),
      );
    }

    const products = buildProducts();
    const importPreview = await optional('preview importacao estoque', () =>
      api('/stock/import', { method: 'POST', body: { products, existing_mode: 'preview' } }),
    );
    if (!importPreview) throw new Error('Importacao em preview falhou; teste interrompido.');

    await optional('importar produtos stress', () =>
      api('/stock/import', { method: 'POST', body: { products, existing_mode: 'update' } }),
    );

    const catalog = await api('/products/catalog?limit=3000');
    const stressProducts = catalog.filter((product) => String(product.name || '').startsWith(RUN_ID));
    created.products = stressProducts;
    pushResult('catalogo com produtos stress', stressProducts.length >= Math.min(STRESS.products, catalog.length), `${stressProducts.length} produto(s) encontrados`);
    if (!stressProducts.length) throw new Error('Nenhum produto de stress encontrado no catalogo.');

    const roleSession = await runRolePermissionTests(stressProducts);
    if (roleSession) {
      me = roleSession;
      cashState = null;
    }

    const sales = await runPool(STRESS.sales, STRESS.parallelSales, async (index) => {
      try {
        const sale = await api('/sales/complete', {
          method: 'POST',
          body: salePayload(stressProducts, index),
          timeout: STRESS.requestTimeoutMs,
        });
        if (index % 10 === 0) console.log(`Vendas criadas: ${index}/${STRESS.sales}`);
        return { ok: true, sale };
      } catch (error) {
        return { ok: false, error: `${error.status || 'ERR'} - ${error.message}` };
      }
    });
    created.sales = sales.filter((item) => item.ok).map((item) => item.sale);
    const failedSales = sales.filter((item) => !item.ok);
    pushResult('criar vendas stress', failedSales.length === 0, `${created.sales.length}/${STRESS.sales} venda(s), falhas: ${failedSales.length}`);
    if (failedSales.length) console.table(failedSales.slice(0, 20));

    const saleToCancel = created.sales.find((sale) => sale.sale_type !== 'fiado');
    if (saleToCancel?.id) {
      await optional('cancelar uma venda teste', () =>
        api(`/sales/${saleToCancel.id}/cancel`, {
          method: 'POST',
          body: { reason: `${RUN_ID} cancelamento de teste` },
        }),
      );
    }

    const fiados = await optional('listar fiados', () => api('/entities/FiadoRecord?sort=-created_date&limit=1000'));
    created.fiados = Array.isArray(fiados)
      ? fiados.filter((item) => String(item.responsible_name || '').startsWith(RUN_ID))
      : [];
    const fiadoToSettle = created.fiados.find((item) => item.status === 'pendente');
    if (fiadoToSettle?.id) {
      await optional('quitar um fiado teste', () =>
        api(`/entities/FiadoRecord/${fiadoToSettle.id}`, {
          method: 'PATCH',
          body: { status: 'quitado', settlement_method: 'pix' },
        }),
      );
    }

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    await optional('listar vendas paginadas', () => api('/sales/list?page=1&page_size=100&include_sellers=1'));
    await optional('relatorio vendas do dia', () => api(`/sales/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`));
    await optional('historico de caixas', () => api('/cash/history?page=1&page_size=20'));
    await optional('auditoria geral', () => api('/entities/GeneralAudit?sort=-created_date&limit=100'));
    await optional('auditoria produtos', () => api('/entities/ProductAudit?sort=-created_date&limit=100'));

    const financeBootstrap = await optional('financeiro bootstrap', () => api('/finance/bootstrap'));
    if (financeBootstrap) {
      const category = (financeBootstrap.categories || []).find((item) => item.type === 'expense' && item.active !== false);
      const account = (financeBootstrap.accounts || []).find((item) => item.active !== false);
      if (category && account) {
        const tx = await optional('criar lancamento financeiro', () =>
          api('/finance/transactions', {
            method: 'POST',
            body: {
              type: 'expense',
              description: `${RUN_ID} despesa stress`,
              amount: 49.9,
              issue_date: today(),
              due_date: addDays(2),
              payment_method: 'pix',
              category_id: category.id,
              account_id: account.id,
              notes: 'Lancamento criado pelo teste de stress do console',
            },
          }),
        );
        if (tx?.id) {
          created.finance.push(tx);
          await optional('pagar lancamento financeiro', () =>
            api(`/finance/transactions/${tx.id}/pay`, {
              method: 'POST',
              body: { amount: 49.9, paid_at: today(), payment_method: 'pix', account_id: account.id },
            }),
          );
        }
      }
      await optional('financeiro dashboard', () => api(`/finance/dashboard?from=${today()}&to=${today()}`));
      await optional('financeiro ledger', () => api('/finance/ledger?page=1&page_size=50'));
      await optional('financeiro recebiveis', () => api('/finance/receivables?page=1&page_size=50'));
      await optional('financeiro conciliacao', () => api('/finance/reconciliation?page=1&page_size=50'));
      await optional('financeiro historico', () => api('/finance/history?limit=50'));
    }

    await optional('alertas estoque preview', () => api('/stock-alerts/preview'));
    await optional('configuracoes estoque alerta', () => api('/stock-alerts/settings'));
    await optional('usuarios listagem', () => api('/entities/User?sort=full_name&limit=200'));
    await runPdvPrintAndSaveTests(me, stressProducts, created.sales[0]);

    if (STRESS.loadScreens) {
      const routes = ['/', '/login', '/pdv', '/estoque', '/vendas', '/fiados', '/relatorios', '/caixas', '/financeiro', '/usuarios', '/configuracoes', '/auditoria'];
      for (const route of routes) {
        for (const viewport of ['desktop', 'mobile']) {
          const loaded = await loadScreen(route, viewport);
          pushResult(`render ${route} ${viewport}`, loaded.ok, loaded.detail);
        }
      }
    }

    if (STRESS.closeCashAtEnd && cashState?.session?.id) {
      await optional('fechar caixa ao final', () =>
        api('/cash/close', { method: 'POST', body: { closing_amount: '' } }),
      );
    }

    const duration = money((performance.now() - startedAt) / 1000);
    console.log('%cRESUMO DO STRESS', 'font-size:16px;font-weight:900;color:#10b981');
    console.table(results);
    console.log('Criados:', {
      runId: RUN_ID,
      products: created.products.length,
      sales: created.sales.length,
      fiados: created.fiados.length,
      finance: created.finance.length,
      seconds: duration,
    });
    const failures = results.filter((item) => !item.ok);
    if (failures.length) {
      console.warn(`Stress finalizado com ${failures.length} falha(s). Veja a tabela acima.`);
    } else {
      console.log('%cStress finalizado sem falhas registradas.', 'font-weight:900;color:#10b981');
    }
    window.__NEXO_STRESS_LAST_RUN__ = { runId: RUN_ID, config: STRESS, results, created };
  }

  try {
    await main();
  } catch (error) {
    pushResult('erro fatal do stress', false, `${error.status || error.name || 'ERR'} - ${error.message}`);
    console.error(error);
    console.table(results);
    window.__NEXO_STRESS_LAST_RUN__ = { runId: RUN_ID, config: STRESS, results, created, fatal: error };
  }
})();
