import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cashClosingAvailability,
  cashSessionForUser,
  cashSummaryForUser,
  normalizeCashClosingSchedule,
  normalizeCashClosingTime,
} from '../server/cash-access.js';
import { isCashClosingTimeBlocked } from '../src/lib/cash-closing-time.js';

const root = process.cwd();

test('horário mínimo usa o horário de Brasília e bloqueia antes do limite', () => {
  const user = {
    role: 'vendedor',
    cash_closing_time_enabled: true,
    cash_closing_min_time: '19:00',
  };
  assert.equal(normalizeCashClosingTime('19:00:00'), '19:00');
  assert.equal(normalizeCashClosingTime('25:00'), null);
  assert.equal(
    cashClosingAvailability(user, new Date('2026-09-03T21:59:00Z')).can_close,
    false,
  );
  assert.equal(
    cashClosingAvailability(user, new Date('2026-09-03T22:00:00Z')).can_close,
    true,
  );
  const closingTime = {
    enabled: true,
    minimum_time: '19:00',
    can_close: false,
  };
  assert.equal(
    isCashClosingTimeBlocked(closingTime, new Date('2026-09-03T21:59:00Z')),
    true,
  );
  assert.equal(
    isCashClosingTimeBlocked(closingTime, new Date('2026-09-03T22:00:00Z')),
    false,
  );
});

test('administradores e gerentes ignoram o horário mínimo de fechamento', () => {
  for (const role of ['admin', 'gerente']) {
    const availability = cashClosingAvailability(
      {
        role,
        cash_closing_time_enabled: true,
        cash_closing_min_time: '23:59',
      },
      new Date('2026-09-03T12:00:00Z'),
    );
    assert.equal(availability.can_close, true);
    assert.equal(availability.enabled, false);
  }

  const cashRoutes = readFileSync(join(root, 'server', 'cash', 'routes.js'), 'utf8');
  const cashDetail = readFileSync(
    join(root, 'src', 'features', 'cash-history', 'components', 'CashDetail.jsx'),
    'utf8',
  );
  assert.match(cashRoutes, /\['admin', 'gerente'\]\.includes\(user\.role\)/);
  assert.match(cashRoutes, /cash_session_id/);
  assert.match(cashDetail, /Fechar caixa/);
});

test('agenda semanal aceita vários dias e horários e bloqueia dias não selecionados', () => {
  const schedule = normalizeCashClosingSchedule({
    1: '19:00',
    2: '20:30',
    5: '18:15',
  });
  assert.deepEqual(schedule, { 1: '19:00', 2: '20:30', 5: '18:15' });
  assert.equal(normalizeCashClosingSchedule({ 1: '25:00' }), null);
  const seller = {
    role: 'vendedor',
    cash_closing_time_enabled: true,
    cash_closing_schedule: schedule,
  };

  // 07/09/2026 é segunda-feira; 22:00 UTC corresponde a 19:00 em Brasília.
  assert.equal(
    cashClosingAvailability(seller, new Date('2026-09-07T21:59:00Z')).can_close,
    false,
  );
  assert.equal(
    cashClosingAvailability(seller, new Date('2026-09-07T22:00:00Z')).can_close,
    true,
  );
  assert.equal(
    cashClosingAvailability(seller, new Date('2026-09-09T23:00:00Z')).can_close,
    false,
  );

  const scheduleField = readFileSync(
    join(
      root,
      'src',
      'components',
      'users',
      'CashClosingScheduleField.jsx',
    ),
    'utf8',
  );
  assert.match(scheduleField, /Segunda-feira/);
  assert.match(scheduleField, /Domingo/);
  assert.match(scheduleField, /type="time"/);
  assert.match(scheduleField, /toggleDay/);
});

test('API remove valores financeiros do resumo de caixa do vendedor', () => {
  const seller = { role: 'vendedor' };
  assert.deepEqual(
    cashSummaryForUser(seller, {
      sales_count: 7,
      total: 300,
      expected_cash: 120,
      difference: 5,
    }),
    { sales_count: 7 },
  );
  const session = cashSessionForUser(seller, {
    id: 'cash-1',
    status: 'aberto',
    opening_amount: 50,
    closing_amount: 100,
    difference: 2,
  });
  assert.deepEqual(session, { id: 'cash-1', status: 'aberto' });
});

test('interface e API mantêm a restrição financeira e o bloqueio do fechamento', () => {
  const sales = readFileSync(join(root, 'src', 'pages', 'Vendas.jsx'), 'utf8');
  const cashModal = readFileSync(join(root, 'src', 'components', 'pdv', 'CashRegisterModal.jsx'), 'utf8');
  const cashRoutes = readFileSync(join(root, 'server', 'cash', 'routes.js'), 'utf8');
  const mockApi = readFileSync(join(root, 'src', 'api', 'mockNexoApi.js'), 'utf8');
  const roleSwitcher = readFileSync(join(root, 'src', 'components', 'TestRoleSwitcher.jsx'), 'utf8');
  const pdv = readFileSync(join(root, 'src', 'pages', 'PDV.jsx'), 'utf8');
  assert.match(sales, /user\.role !== 'vendedor'/);
  assert.match(sales, /Quantidade de vendas/);
  assert.match(cashModal, /canSeeCashBalances/);
  assert.match(cashModal, /closingTimeBlocked/);
  assert.match(pdv, /isCashClosingTimeBlocked\(latestCash\.closing_time\)/);
  assert.match(pdv, /latestCash = await refreshCash\(\)/);
  assert.match(cashRoutes, /CASH_CLOSING_TIME_RESTRICTED/);
  assert.match(mockApi, /vendedor@nexopdv\.local/);
  assert.match(mockApi, /vendedor123/);
  assert.match(mockApi, /simulateRole/);
  assert.match(roleSwitcher, /VITE_MOCK_API/);
  assert.match(roleSwitcher, /Simular cargo/);
  assert.match(roleSwitcher, /vendedor/);
  assert.match(roleSwitcher, /gerente/);
  assert.match(roleSwitcher, /admin/);
});

test('simulador restaura o cargo selecionado após recarregar a sessão', async () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  try {
    const { mockNexoApi } = await import('../src/api/mockNexoApi.js?role-switch-test');
    for (const role of ['vendedor', 'gerente', 'admin']) {
      await mockNexoApi.auth.simulateRole(role);
      const restored = await mockNexoApi.auth.me();
      assert.equal(restored.role, role);
    }
  } finally {
    delete globalThis.localStorage;
  }
});

test('vendedor não acessa histórico de caixas e os modais usam layouts adaptáveis', () => {
  const navigation = readFileSync(join(root, 'src', 'config', 'navigation.jsx'), 'utf8');
  const cashRoutes = readFileSync(join(root, 'server', 'cash', 'routes.js'), 'utf8');
  const cashModal = readFileSync(join(root, 'src', 'components', 'pdv', 'CashRegisterModal.jsx'), 'utf8');
  const receipt = readFileSync(join(root, 'src', 'components', 'pdv', 'ReceiptModal.jsx'), 'utf8');
  const styles = readFileSync(join(root, 'src', 'styles', 'system.css'), 'utf8');
  const cashMenuStart = navigation.indexOf("label: 'Histórico de caixas'");
  const cashMenu = navigation
    .slice(cashMenuStart)
    .match(/roles: \[([^\]]+)\]/)?.[1] || '';

  assert.doesNotMatch(cashMenu, /vendedor/);
  assert.match(cashRoutes, /histórico de caixas é restrito a gerentes e administradores/);
  assert.match(cashModal, /canSeeCashBalances \? "sm:max-w-\[56rem\]" : "sm:max-w-\[34rem\]"/);
  assert.match(receipt, /receipt-modal-body/);
  assert.match(styles, /\.receipt-modal-body \.r-item/);
  assert.match(styles, /@container \(max-width: 21rem\)/);
});
