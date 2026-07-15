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
    requestTimeoutMs: 90_000,
    ...(window.__NEXO_STRESS_CONFIG__ || {}),
  };

  const RUN_ID = `STRESS-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
  const startedAt = performance.now();
  const results = [];
  const created = { products: [], sales: [], fiados: [], finance: [] };

  const money = (value) => Math.round(Number(value || 0) * 100) / 100;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
        return sum + qty * item.unit_price;
      }, 0),
    );
    const isFiado = STRESS.fiadoEvery > 0 && index % STRESS.fiadoEvery === 0;
    const method = pick(['dinheiro', 'pix', 'debito', 'credito', 'outros'], index);
    return {
      items,
      payments: isFiado
        ? [{ method: 'fiado', amount: total }]
        : [{ method, amount: method === 'dinheiro' ? money(total + (index % 3)) : total }],
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

  async function loadScreen(route, viewport) {
    return new Promise((resolve) => {
      const frame = document.createElement('iframe');
      let settled = false;
      const timeout = setTimeout(() => inspect(true), 18_000);
      const done = (ok, detail) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        try {
          frame.remove();
        } catch {}
        resolve({ route, viewport, ok, detail });
      };
      const inspect = (final = false) => {
        try {
          const doc = frame.contentDocument;
          const root = doc?.querySelector('#root');
          const text = String(root?.innerText || doc?.body?.innerText || '').trim();
          const buttons = doc?.querySelectorAll('button,[role="button"],a,input,select,textarea').length || 0;
          const ready = root && (root.childElementCount > 0 || text.length > 20 || buttons > 0);
          if (ready || final) {
            const currentPath = frame.contentWindow?.location?.pathname || route;
            const htmlLength = doc?.documentElement?.outerHTML?.length || 0;
            done(Boolean(ready), `${text.length} chars, ${buttons} interativos, html ${htmlLength}, rota ${currentPath}`);
          } else {
            setTimeout(() => inspect(false), 500);
          }
        } catch (error) {
          done(false, error.message);
        }
      };
      frame.style.cssText = [
        'position:fixed',
        'left:-200vw',
        'top:0',
        `width:${viewport === 'mobile' ? 390 : 1366}px`,
        `height:${viewport === 'mobile' ? 844 : 768}px`,
        'opacity:0',
        'pointer-events:none',
        'border:0',
      ].join(';');
      frame.onload = () => setTimeout(() => inspect(false), 750);
      frame.src = `${route}${route.includes('?') ? '&' : '?'}stress=${encodeURIComponent(RUN_ID)}&vp=${viewport}`;
      document.body.appendChild(frame);
    });
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

    const me = await api('/auth/me');
    pushResult('sessao autenticada', true, `${me.email || me.full_name || me.id} / ${me.role}`);

    await optional('healthcheck', () => api('/health'));

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
