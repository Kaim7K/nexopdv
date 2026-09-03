import bcrypt from 'bcryptjs';
import { roundMoney } from '../cash-summary.js';
import { methodNotAllowed, send } from '../http.js';

export async function handlePlatformRequest(
  { req, res, sql, user, path },
  {
    MARKET_FEATURES,
    MARKET_MODULES,
    isUuid,
    normalizeImageValue,
    parseDateQuery,
    text,
  },
) {
  if (path[0] === 'system' && path[1] === 'reload') {
    if (req.method === 'GET') {
      const [setting] = await sql`
        SELECT value #>> '{}' AS reload_token, updated_date
        FROM nexo.platform_settings
        WHERE key='system_reload_token'
      `;
      return send(res, 200, {
        reload_token: setting?.reload_token || '0',
        requested_at: setting?.updated_date || null,
      });
    }
    if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
    if (user.role !== 'super_admin')
      return send(res, 403, {
        message: 'Apenas o Super Admin pode recarregar todos os dispositivos.',
      });

    const reloadToken = `${Date.now()}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    const [setting] = await sql`
      INSERT INTO nexo.platform_settings(key,value,updated_by)
      VALUES('system_reload_token',${JSON.stringify(reloadToken)}::jsonb,${user.id})
      ON CONFLICT(key) DO UPDATE SET
        value=excluded.value,
        updated_by=excluded.updated_by,
        updated_date=now()
      RETURNING value #>> '{}' AS reload_token, updated_date
    `;
    return send(res, 200, {
      ok: true,
      reload_token: setting.reload_token,
      requested_at: setting.updated_date,
    });
  }

  if (path[0] === 'admin') {
    if (user.role !== 'super_admin')
      return send(res, 403, { message: 'Acesso restrito ao Super Admin.' });

    if (path[1] === 'logs' && req.method === 'GET') {
      const rows = await sql`
        SELECT log.id,log.action,log.details,log.created_date,market.name AS market_name,COALESCE(actor.full_name,actor.email,'Sistema') AS actor_name,'administração' AS source
        FROM nexo.market_change_log log
        JOIN nexo.markets market ON market.id=log.market_id
        LEFT JOIN nexo.users actor ON actor.id=log.actor_id
        UNION ALL
        SELECT audit.id,COALESCE(audit.data->>'action_type','evento'),audit.data->'details',audit.created_date,market.name,COALESCE(audit.data->>'user_name','Sistema'),'mercadinho'
        FROM nexo.records audit JOIN nexo.markets market ON market.id=audit.market_id
        WHERE audit.entity='general_audits'
        ORDER BY created_date DESC LIMIT 200
      `;
      return send(res, 200, rows);
    }

    if (path[1] === 'overview' && req.method === 'GET') {
      const [metrics, marketGrowth] = await Promise.all([
        sql`SELECT
          (SELECT count(*)::int FROM nexo.markets) AS total_markets,
          (SELECT count(*)::int FROM nexo.markets WHERE status='ativo') AS active_markets,
          (SELECT count(*)::int FROM nexo.markets WHERE status='suspenso') AS suspended_markets,
          (SELECT count(*)::int FROM nexo.markets WHERE status='teste') AS trial_markets,
          (SELECT count(*)::int FROM nexo.users WHERE role<>'super_admin' AND active) AS total_users,
          (SELECT count(*)::int FROM nexo.users WHERE role<>'super_admin' AND active AND last_login_at>=now()-interval '30 days') AS active_users,
          (SELECT count(*)::int FROM nexo.markets WHERE created_date>=now()-interval '30 days') AS new_markets,
          (SELECT count(*)::int FROM nexo.subscriptions WHERE cancelled_at>=now()-interval '30 days') AS cancellations,
          (SELECT COALESCE(sum(monthly_price),0)::numeric FROM nexo.subscriptions WHERE status IN ('ativa','teste')) AS estimated_revenue,
          (SELECT count(*)::int FROM nexo.records WHERE entity='sales' AND data->>'status'='concluida') AS processed_sales,
          (SELECT COALESCE(sum((data->>'total')::numeric),0)::numeric FROM nexo.records WHERE entity='sales' AND data->>'status'='concluida' AND data->>'total' ~ '^[0-9]+(\\.[0-9]+)?$') AS processed_volume,
          (SELECT count(*)::int FROM nexo.records WHERE entity='products') AS products,
          (SELECT count(*)::int FROM nexo.plans WHERE active) AS active_plans`,
        sql`WITH months AS (SELECT generate_series(date_trunc('month',now())-interval '11 months',date_trunc('month',now()),interval '1 month') AS month) SELECT to_char(month,'YYYY-MM') AS month,count(market.id)::int AS markets FROM months LEFT JOIN nexo.markets market ON date_trunc('month',market.created_date)=months.month GROUP BY month ORDER BY month`,
      ]);
      return send(res, 200, {
        metrics: {
          ...metrics[0],
          estimated_revenue: Number(metrics[0]?.estimated_revenue || 0),
          processed_volume: Number(metrics[0]?.processed_volume || 0),
        },
        market_growth: marketGrowth,
      });
    }

    if (path[1] === 'plans') {
      if (req.method === 'GET') {
        const plans =
          await sql`SELECT plan.*,(SELECT count(*)::int FROM nexo.subscriptions subscription WHERE subscription.plan_id=plan.id AND subscription.status IN ('teste','ativa','inadimplente','suspensa')) AS subscription_count,(SELECT count(*)::int FROM nexo.subscriptions subscription WHERE subscription.plan_id=plan.id) AS total_subscription_count,(SELECT count(*)::int FROM nexo.markets market WHERE market.plan_id=plan.id) AS market_count FROM nexo.plans plan ORDER BY plan.active DESC,plan.monthly_price,plan.name`;
        return send(
          res,
          200,
          plans.map((plan) => ({
            ...plan,
            monthly_price: Number(plan.monthly_price),
          })),
        );
      }
      const planId = path[2];
      if (!['POST', 'PATCH', 'DELETE'].includes(req.method))
        return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
      if (req.method !== 'POST' && !isUuid(planId))
        return send(res, 400, { message: 'Plano inválido.' });
      if (req.method === 'DELETE') {
        const [usage] =
          await sql`SELECT (SELECT count(*)::int FROM nexo.subscriptions WHERE plan_id=${planId}) AS subscriptions,(SELECT count(*)::int FROM nexo.markets WHERE plan_id=${planId}) AS markets`;
        if (
          Number(usage?.subscriptions || 0) > 0 ||
          Number(usage?.markets || 0) > 0
        )
          return send(res, 409, {
            code: 'PLAN_IN_USE',
            message:
              'Este plano possui histórico ou mercadinhos vinculados. Desative-o para impedir novas contratações.',
          });
        const [removed] =
          await sql`DELETE FROM nexo.plans WHERE id=${planId} RETURNING id,name`;
        return send(
          res,
          removed ? 200 : 404,
          removed
            ? { ok: true, plan: removed }
            : { message: 'Plano não encontrado.' },
        );
      }
      const source = req.body || {};
      const name = text(source.name, 120);
      const description = text(source.description, 1000);
      const monthlyPrice = Number(source.monthly_price);
      const trialDays = Number.parseInt(source.trial_days, 10) || 0;
      const modules = Array.isArray(source.enabled_modules)
        ? source.enabled_modules
        : [];
      const features = Array.isArray(source.enabled_features)
        ? source.enabled_features
        : [];
      if (
        !name ||
        !Number.isFinite(monthlyPrice) ||
        monthlyPrice < 0 ||
        trialDays < 0 ||
        trialDays > 365
      )
        return send(res, 400, {
          message: 'Revise nome, preço e período de teste do plano.',
        });
      if (modules.some((module) => !MARKET_MODULES.includes(module)))
        return send(res, 400, {
          message: 'O plano contém funcionalidades inválidas.',
        });
      if (features.some((feature) => !MARKET_FEATURES.includes(feature)))
        return send(res, 400, {
          message: 'O plano contém recursos inválidos.',
        });
      if (source.active !== false && !modules.length)
        return send(res, 400, {
          message:
            'Um plano ativo deve oferecer pelo menos uma funcionalidade.',
        });
      const limit = (value) =>
        value === '' || value === null || value === undefined
          ? null
          : Math.max(1, Number.parseInt(value, 10) || 1);
      const values = {
        name,
        description,
        monthlyPrice: roundMoney(monthlyPrice),
        trialDays,
        userLimit: limit(source.user_limit),
        productLimit: limit(source.product_limit),
        unitLimit: limit(source.unit_limit),
        modules,
        features,
        active: source.active !== false,
      };
      if (req.method === 'POST') {
        const [plan] =
          await sql`INSERT INTO nexo.plans(name,description,monthly_price,trial_days,user_limit,product_limit,unit_limit,enabled_modules,enabled_features,active) VALUES(${values.name},${values.description},${values.monthlyPrice},${values.trialDays},${values.userLimit},${values.productLimit},${values.unitLimit},${JSON.stringify(values.modules)}::jsonb,${JSON.stringify(values.features)}::jsonb,${values.active}) RETURNING *`;
        return send(res, 201, {
          ...plan,
          monthly_price: Number(plan.monthly_price),
        });
      }
      const [plan] =
        await sql`UPDATE nexo.plans SET name=${values.name},description=${values.description},monthly_price=${values.monthlyPrice},trial_days=${values.trialDays},user_limit=${values.userLimit},product_limit=${values.productLimit},unit_limit=${values.unitLimit},enabled_modules=${JSON.stringify(values.modules)}::jsonb,enabled_features=${JSON.stringify(values.features)}::jsonb,active=${values.active},updated_date=now() WHERE id=${planId} RETURNING *`;
      return send(
        res,
        plan ? 200 : 404,
        plan
          ? { ...plan, monthly_price: Number(plan.monthly_price) }
          : { message: 'Plano não encontrado.' },
      );
    }

    if (path[1] === 'subscriptions') {
      if (req.method === 'GET') {
        const rows =
          await sql`SELECT subscription.*,market.name AS market_name,plan.name AS plan_name FROM nexo.subscriptions subscription JOIN nexo.markets market ON market.id=subscription.market_id LEFT JOIN nexo.plans plan ON plan.id=subscription.plan_id ORDER BY subscription.updated_date DESC`;
        return send(
          res,
          200,
          rows.map((row) => ({
            ...row,
            monthly_price: Number(row.monthly_price),
          })),
        );
      }
      if (req.method !== 'PATCH' || !isUuid(path[2]))
        return methodNotAllowed(res, ['GET', 'PATCH']);
      const status = text(req.body.status, 30);
      if (
        !['teste', 'ativa', 'inadimplente', 'cancelada', 'suspensa'].includes(
          status,
        )
      )
        return send(res, 400, { message: 'Status de assinatura inválido.' });
      const reason = text(req.body.cancellation_reason, 500);
      const [subscription] =
        await sql`UPDATE nexo.subscriptions SET status=${status},cancelled_at=CASE WHEN ${status}='cancelada' THEN now() ELSE NULL END,cancellation_reason=CASE WHEN ${status}='cancelada' THEN ${reason} ELSE NULL END,updated_date=now() WHERE id=${path[2]} RETURNING *`;
      if (!subscription)
        return send(res, 404, { message: 'Assinatura não encontrada.' });
      const marketStatus =
        status === 'cancelada'
          ? 'cancelado'
          : status === 'suspensa' || status === 'inadimplente'
            ? 'suspenso'
            : status === 'teste'
              ? 'teste'
              : 'ativo';
      await sql`WITH changed AS (UPDATE nexo.markets SET status=${marketStatus},active=${!['cancelado', 'suspenso'].includes(marketStatus)},updated_date=now() WHERE id=${subscription.market_id} RETURNING id) INSERT INTO nexo.market_change_log(market_id,actor_id,action,details) SELECT id,${user.id},'assinatura_atualizada',${JSON.stringify({ status, reason })}::jsonb FROM changed`;
      return send(res, 200, {
        ...subscription,
        monthly_price: Number(subscription.monthly_price),
      });
    }

    if (path[1] === 'payments') {
      if (req.method === 'GET') {
        const subscriptionId = text(req.query.subscription_id, 64);
        const rows =
          await sql`SELECT payment.*,market.name AS market_name,plan.name AS plan_name FROM nexo.subscription_payments payment JOIN nexo.subscriptions subscription ON subscription.id=payment.subscription_id JOIN nexo.markets market ON market.id=subscription.market_id LEFT JOIN nexo.plans plan ON plan.id=subscription.plan_id WHERE (${subscriptionId === ''} OR payment.subscription_id::text=${subscriptionId}) ORDER BY payment.due_date DESC LIMIT 1000`;
        return send(
          res,
          200,
          rows.map((row) => ({ ...row, amount: Number(row.amount) })),
        );
      }
      if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
      if (!isUuid(req.body.subscription_id))
        return send(res, 400, { message: 'Assinatura inválida.' });
      const amount = roundMoney(Number(req.body.amount));
      const dueDate = parseDateQuery(req.body.due_date);
      const paymentStatus = [
        'pendente',
        'pago',
        'vencido',
        'estornado',
      ].includes(req.body.status)
        ? req.body.status
        : 'pendente';
      if (!Number.isFinite(amount) || amount < 0 || !dueDate)
        return send(res, 400, {
          message: 'Informe valor e vencimento válidos.',
        });
      const [payment] =
        await sql`INSERT INTO nexo.subscription_payments(subscription_id,amount,due_date,paid_at,status,notes) VALUES(${req.body.subscription_id},${amount},${dueDate.toISOString().slice(0, 10)},${paymentStatus === 'pago' ? new Date() : null},${paymentStatus},${text(req.body.notes, 500)}) RETURNING *`;
      return send(res, 201, { ...payment, amount: Number(payment.amount) });
    }

    if (path[1] === 'reports' && req.method === 'GET') {
      const from = parseDateQuery(
        req.query.from,
        new Date(Date.now() - 365 * 86_400_000),
      );
      const to = parseDateQuery(req.query.to, new Date());
      const [growth, revenue, cancellations, usage] = await Promise.all([
        sql`SELECT to_char(date_trunc('month',created_date),'YYYY-MM') AS period,count(*)::int AS new_markets FROM nexo.markets WHERE created_date>=${from} AND created_date<${to} GROUP BY 1 ORDER BY 1`,
        sql`SELECT COALESCE(plan.name,'Sem plano') AS plan,count(subscription.id)::int AS subscriptions,COALESCE(sum(subscription.monthly_price),0)::numeric AS revenue FROM nexo.subscriptions subscription LEFT JOIN nexo.plans plan ON plan.id=subscription.plan_id WHERE subscription.status IN ('ativa','teste') GROUP BY plan.name ORDER BY revenue DESC`,
        sql`SELECT to_char(date_trunc('month',cancelled_at),'YYYY-MM') AS period,count(*)::int AS cancellations FROM nexo.subscriptions WHERE cancelled_at>=${from} AND cancelled_at<${to} GROUP BY 1 ORDER BY 1`,
        sql`SELECT market.id,market.name,count(DISTINCT sale.id)::int AS sales,count(DISTINCT product.id)::int AS products,count(DISTINCT active_user.id)::int AS active_users,COALESCE(sum(CASE WHEN sale.data->>'total' ~ '^[0-9]+(\\.[0-9]+)?$' THEN (sale.data->>'total')::numeric ELSE 0 END),0)::numeric AS sales_volume FROM nexo.markets market LEFT JOIN nexo.records sale ON sale.market_id=market.id AND sale.entity='sales' AND sale.data->>'status'='concluida' AND sale.created_date>=${from} AND sale.created_date<${to} LEFT JOIN nexo.records product ON product.market_id=market.id AND product.entity='products' LEFT JOIN nexo.users active_user ON active_user.market_id=market.id AND active_user.active AND active_user.last_login_at>=${from} AND active_user.last_login_at<${to} GROUP BY market.id,market.name ORDER BY sales DESC`,
      ]);
      return send(res, 200, {
        growth,
        revenue: revenue.map((row) => ({
          ...row,
          revenue: Number(row.revenue),
        })),
        cancellations,
        usage: usage.map((row) => ({
          ...row,
          sales_volume: Number(row.sales_volume),
        })),
      });
    }

    if (path[1] === 'settings') {
      const allowed = new Set([
        'email_provider',
        'email_from_name',
        'notification_defaults',
        'plan_enforcement',
        'global_user_limit',
        'global_product_limit',
        'global_unit_limit',
        'security_session_hours',
        'security_login_attempts',
        'integrations',
        'maintenance_mode',
        'maintenance_message',
        'platform_notice',
      ]);
      if (req.method === 'GET') {
        const rows =
          await sql`SELECT key,value,updated_date FROM nexo.platform_settings ORDER BY key`;
        return send(
          res,
          200,
          Object.fromEntries(
            rows.map((row) => [
              row.key,
              { value: row.value, updated_date: row.updated_date },
            ]),
          ),
        );
      }
      if (req.method !== 'PATCH')
        return methodNotAllowed(res, ['GET', 'PATCH']);
      const entries = Object.entries(req.body || {}).filter(([key]) =>
        allowed.has(key),
      );
      if (!entries.length)
        return send(res, 400, {
          message: 'Nenhuma configuração válida foi informada.',
        });
      for (const [key, value] of entries)
        await sql`INSERT INTO nexo.platform_settings(key,value,updated_by) VALUES(${key},${JSON.stringify(value)}::jsonb,${user.id}) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_date=now()`;
      return send(res, 200, { ok: true, updated: entries.length });
    }

    return send(res, 404, { message: 'Área administrativa não encontrada.' });
  }

  if (path[0] === 'markets') {
    if (user.role !== 'super_admin')
      return send(res, 403, { message: 'Acesso restrito.' });
    if (req.method === 'GET' && isUuid(path[1])) {
      const [marketRows, units, history, subscriptions, payments] =
        await Promise.all([
          sql`SELECT market.*,plan.name AS plan_name,plan.monthly_price AS plan_price,(SELECT count(*)::int FROM nexo.users WHERE market_id=market.id AND active) AS user_count,(SELECT count(*)::int FROM nexo.records WHERE market_id=market.id AND entity='products') AS product_count,(SELECT count(*)::int FROM nexo.records WHERE market_id=market.id AND entity='sales') AS sale_count FROM nexo.markets market LEFT JOIN nexo.plans plan ON plan.id=market.plan_id WHERE market.id=${path[1]}`,
          sql`SELECT id,name,code,active,created_date FROM nexo.market_units WHERE market_id=${path[1]} ORDER BY name`,
          sql`SELECT log.*,COALESCE(actor.full_name,actor.email,'Sistema') AS actor_name FROM nexo.market_change_log log LEFT JOIN nexo.users actor ON actor.id=log.actor_id WHERE log.market_id=${path[1]} ORDER BY log.created_date DESC LIMIT 100`,
          sql`SELECT subscription.*,plan.name AS plan_name FROM nexo.subscriptions subscription LEFT JOIN nexo.plans plan ON plan.id=subscription.plan_id WHERE subscription.market_id=${path[1]} ORDER BY subscription.created_date DESC`,
          sql`SELECT payment.* FROM nexo.subscription_payments payment JOIN nexo.subscriptions subscription ON subscription.id=payment.subscription_id WHERE subscription.market_id=${path[1]} ORDER BY payment.due_date DESC LIMIT 100`,
        ]);
      if (!marketRows[0])
        return send(res, 404, { message: 'Mercadinho não encontrado.' });
      return send(res, 200, {
        market: {
          ...marketRows[0],
          plan_price: Number(marketRows[0].plan_price || 0),
        },
        units,
        history,
        subscriptions: subscriptions.map((item) => ({
          ...item,
          monthly_price: Number(item.monthly_price),
        })),
        payments: payments.map((item) => ({
          ...item,
          amount: Number(item.amount),
        })),
      });
    }
    if (req.method === 'GET')
      return send(
        res,
        200,
        await sql`SELECT market.id,market.name,market.slug,market.logo_url,market.primary_color,market.secondary_color,market.enabled_modules,market.enabled_features,market.require_cash_register,market.active,market.status,market.plan_id,plan.name AS plan_name,market.trial_ends_at,market.subscription_due_date,market.user_limit,market.product_limit,market.unit_limit,market.created_date,(SELECT count(*)::int FROM nexo.users WHERE market_id=market.id AND active) AS user_count FROM nexo.markets market LEFT JOIN nexo.plans plan ON plan.id=market.plan_id ORDER BY market.name`,
      );
    if (req.method === 'POST') {
      const marketName = text(req.body.name, 120);
      const marketSlug = text(req.body.slug, 80);
      if (!marketName || !/^[a-z0-9-]+$/.test(marketSlug))
        return send(res, 400, { message: 'Nome ou identificador inválido.' });
      if (
        req.body.primary_color &&
        !/^#[0-9a-f]{6}$/i.test(req.body.primary_color)
      )
        return send(res, 400, { message: 'Cor principal inválida.' });
      if (
        req.body.secondary_color &&
        !/^#[0-9a-f]{6}$/i.test(req.body.secondary_color)
      )
        return send(res, 400, { message: 'Cor secundária inválida.' });
      if (
        !/^\S+@\S+\.\S+$/.test(req.body.admin_email || '') ||
        (req.body.admin_password || '').length < 8
      )
        return send(res, 400, { message: 'Email ou senha inicial inválidos.' });
      const hash = await bcrypt.hash(req.body.admin_password, 12);
      const logoUrl = normalizeImageValue(req.body.logo_url || '');
      const requestedPlanId = isUuid(req.body.plan_id)
        ? req.body.plan_id
        : null;
      const [selectedPlan] = requestedPlanId
        ? await sql`SELECT * FROM nexo.plans WHERE id=${requestedPlanId} AND active LIMIT 1`
        : [];
      if (requestedPlanId && !selectedPlan)
        return send(res, 409, {
          code: 'PLAN_INACTIVE',
          message: 'O plano selecionado está inativo ou não existe.',
        });
      const modules =
        selectedPlan?.enabled_modules ||
        req.body.enabled_modules ||
        MARKET_MODULES;
      const features =
        selectedPlan?.enabled_features ||
        req.body.enabled_features ||
        MARKET_FEATURES;
      if (
        !Array.isArray(modules) ||
        modules.some((module) => !MARKET_MODULES.includes(module))
      )
        return send(res, 400, { message: 'Módulos inválidos.' });
      if (
        !Array.isArray(features) ||
        features.some((feature) => !MARKET_FEATURES.includes(feature))
      )
        return send(res, 400, { message: 'Recursos inválidos.' });
      const requestedStatus = ['ativo', 'teste'].includes(req.body.status)
        ? req.body.status
        : 'teste';
      const adminEmail = String(req.body.admin_email).trim().toLowerCase();
      const adminName =
        String(req.body.admin_name || 'Administrador').trim() ||
        'Administrador';
      const [duplicate] = await sql`
        SELECT
          EXISTS(SELECT 1 FROM nexo.markets WHERE lower(slug)=lower(${marketSlug})) AS slug,
          EXISTS(SELECT 1 FROM nexo.users WHERE lower(email)=lower(${adminEmail})) AS email
      `;
      if (duplicate?.slug)
        return send(res, 409, {
          code: 'DUPLICATE_MARKET_SLUG',
          message: 'Já existe um mercado com este identificador.',
        });
      if (duplicate?.email)
        return send(res, 409, {
          code: 'DUPLICATE_ADMIN_EMAIL',
          message: 'Já existe um usuário com este e-mail.',
        });
      const [market] = selectedPlan
        ? await sql`WITH market AS (INSERT INTO nexo.markets(name,slug,logo_url,primary_color,secondary_color,enabled_modules,enabled_features,require_cash_register,status,plan_id,trial_ends_at,user_limit,product_limit,unit_limit) VALUES(${marketName},${marketSlug},${logoUrl},${req.body.primary_color || '#16a06a'},${req.body.secondary_color || '#0f5132'},${JSON.stringify(modules)}::jsonb,${JSON.stringify(features)}::jsonb,${Boolean(req.body.require_cash_register)},${requestedStatus},${selectedPlan.id},CASE WHEN ${requestedStatus}='teste' THEN now()+make_interval(days=>${selectedPlan.trial_days}::int) ELSE NULL END,${selectedPlan.user_limit},${selectedPlan.product_limit},${selectedPlan.unit_limit}) RETURNING *),unit AS (INSERT INTO nexo.market_units(market_id,name,code) SELECT id,'Unidade principal','principal' FROM market RETURNING id,market_id),admin AS (INSERT INTO nexo.users(market_id,unit_id,email,password_hash,full_name,role) SELECT market.id,unit.id,${adminEmail},${hash},${adminName}::text,'admin' FROM market JOIN unit ON unit.market_id=market.id),subscription AS (INSERT INTO nexo.subscriptions(market_id,plan_id,status,monthly_price,trial_ends_at,current_period_ends_at) SELECT market.id,${selectedPlan.id},CASE WHEN ${requestedStatus}='teste' THEN 'teste' ELSE 'ativa' END,${selectedPlan.monthly_price},CASE WHEN ${requestedStatus}='teste' THEN now()+make_interval(days=>${selectedPlan.trial_days}::int) ELSE NULL END,now()+interval '1 month' FROM market),log AS (INSERT INTO nexo.market_change_log(market_id,actor_id,action,details) SELECT id,${user.id},'mercado_criado',jsonb_build_object('status',${requestedStatus}::text,'plan_id',${selectedPlan.id}::uuid) FROM market) SELECT * FROM market`
        : await sql`WITH market AS (INSERT INTO nexo.markets(name,slug,logo_url,primary_color,secondary_color,enabled_modules,enabled_features,require_cash_register,status,trial_ends_at,user_limit,product_limit,unit_limit) VALUES(${marketName},${marketSlug},${logoUrl},${req.body.primary_color || '#16a06a'},${req.body.secondary_color || '#0f5132'},${JSON.stringify(modules)}::jsonb,${JSON.stringify(features)}::jsonb,${Boolean(req.body.require_cash_register)},${requestedStatus},CASE WHEN ${requestedStatus}='teste' THEN now()+interval '14 days' ELSE NULL END,${req.body.user_limit || null},${req.body.product_limit || null},${req.body.unit_limit || null}) RETURNING *),unit AS (INSERT INTO nexo.market_units(market_id,name,code) SELECT id,'Unidade principal','principal' FROM market RETURNING id,market_id),admin AS (INSERT INTO nexo.users(market_id,unit_id,email,password_hash,full_name,role) SELECT market.id,unit.id,${adminEmail},${hash},${adminName}::text,'admin' FROM market JOIN unit ON unit.market_id=market.id),log AS (INSERT INTO nexo.market_change_log(market_id,actor_id,action,details) SELECT id,${user.id},'mercado_criado',jsonb_build_object('status',${requestedStatus}::text) FROM market) SELECT * FROM market`;
      return send(res, 201, market);
    }
    if (req.method === 'PATCH') {
      const id = path[1],
        b = req.body;
      if (!isUuid(id)) return send(res, 400, { message: 'Mercado inválido.' });
      if (
        b.enabled_modules &&
        (!Array.isArray(b.enabled_modules) ||
          b.enabled_modules.some((module) => !MARKET_MODULES.includes(module)))
      )
        return send(res, 400, { message: 'Módulos inválidos.' });
      if (
        b.enabled_features &&
        (!Array.isArray(b.enabled_features) ||
          b.enabled_features.some(
            (feature) => !MARKET_FEATURES.includes(feature),
          ))
      )
        return send(res, 400, { message: 'Recursos inválidos.' });
      const updatedName = b.name === undefined ? null : text(b.name, 120);
      if (b.name !== undefined && !updatedName)
        return send(res, 400, { message: 'Nome do mercado é obrigatório.' });
      if (b.primary_color && !/^#[0-9a-f]{6}$/i.test(b.primary_color))
        return send(res, 400, { message: 'Cor principal inválida.' });
      if (b.secondary_color && !/^#[0-9a-f]{6}$/i.test(b.secondary_color))
        return send(res, 400, { message: 'Cor secundária inválida.' });
      const logoUrl =
        b.logo_url === undefined ? null : normalizeImageValue(b.logo_url);
      const status = ['ativo', 'suspenso', 'teste', 'cancelado'].includes(
        b.status,
      )
        ? b.status
        : typeof b.active === 'boolean'
          ? b.active
            ? 'ativo'
            : 'suspenso'
          : null;
      const planId =
        b.plan_id === null ? null : isUuid(b.plan_id) ? b.plan_id : undefined;
      const [selectedPlan] = planId
        ? await sql`SELECT * FROM nexo.plans WHERE id=${planId} AND active LIMIT 1`
        : [];
      if (planId && !selectedPlan)
        return send(res, 409, {
          code: 'PLAN_INACTIVE',
          message: 'O plano selecionado está inativo ou não existe.',
        });
      const modulesUpdate = selectedPlan?.enabled_modules || b.enabled_modules;
      const featuresUpdate =
        selectedPlan?.enabled_features || b.enabled_features;
      const [market] =
        await sql`WITH changed AS (UPDATE nexo.markets SET name=COALESCE(${updatedName},name),logo_url=COALESCE(${logoUrl},logo_url),primary_color=COALESCE(${b.primary_color || null},primary_color),secondary_color=COALESCE(${b.secondary_color || null},secondary_color),enabled_modules=COALESCE(${modulesUpdate ? JSON.stringify(modulesUpdate) : null}::jsonb,enabled_modules),enabled_features=COALESCE(${featuresUpdate ? JSON.stringify(featuresUpdate) : null}::jsonb,enabled_features),require_cash_register=COALESCE(${typeof b.require_cash_register === 'boolean' ? b.require_cash_register : null},require_cash_register),active=CASE WHEN ${status}::text IS NOT NULL THEN ${!['suspenso', 'cancelado'].includes(status)} ELSE COALESCE(${typeof b.active === 'boolean' ? b.active : null},active) END,status=COALESCE(${status},status),plan_id=CASE WHEN ${planId !== undefined} THEN ${planId || null}::uuid ELSE plan_id END,subscription_due_date=COALESCE(${b.subscription_due_date || null}::date,subscription_due_date),user_limit=CASE WHEN ${Boolean(planId)} THEN ${selectedPlan?.user_limit ?? null} ELSE COALESCE(${b.user_limit || null},user_limit) END,product_limit=CASE WHEN ${Boolean(planId)} THEN ${selectedPlan?.product_limit ?? null} ELSE COALESCE(${b.product_limit || null},product_limit) END,unit_limit=CASE WHEN ${Boolean(planId)} THEN ${selectedPlan?.unit_limit ?? null} ELSE COALESCE(${b.unit_limit || null},unit_limit) END,updated_date=now() WHERE id=${id} RETURNING *),log AS (INSERT INTO nexo.market_change_log(market_id,actor_id,action,details) SELECT id,${user.id},'mercado_atualizado',jsonb_build_object('fields',${JSON.stringify(Object.keys(b || {}))}::jsonb) FROM changed) SELECT * FROM changed`;
      if (market && planId)
        await sql`WITH selected_plan AS (SELECT * FROM nexo.plans WHERE id=${planId} AND active),closed AS (UPDATE nexo.subscriptions SET status='cancelada',cancelled_at=now(),cancellation_reason='Troca de plano',updated_date=now() WHERE market_id=${id} AND status IN ('teste','ativa','inadimplente','suspensa')) INSERT INTO nexo.subscriptions(market_id,plan_id,status,monthly_price,current_period_ends_at) SELECT ${id},id,'ativa',monthly_price,now()+interval '1 month' FROM selected_plan`;
      if (market && status) {
        const subscriptionStatus =
          status === 'cancelado'
            ? 'cancelada'
            : status === 'suspenso'
              ? 'suspensa'
              : status === 'teste'
                ? 'teste'
                : 'ativa';
        await sql`UPDATE nexo.subscriptions SET status=${subscriptionStatus},cancelled_at=CASE WHEN ${subscriptionStatus}='cancelada' THEN now() ELSE NULL END,cancellation_reason=CASE WHEN ${subscriptionStatus}='cancelada' THEN 'Encerramento pelo Super Admin' ELSE NULL END,updated_date=now() WHERE market_id=${id} AND status IN ('teste','ativa','inadimplente','suspensa')`;
      }
      return send(
        res,
        market ? 200 : 404,
        market || { message: 'Mercado não encontrado.' },
      );
    }
    if (req.method === 'DELETE') {
      const id = path[1];
      if (!isUuid(id))
        return send(res, 400, { message: 'Mercadinho inválido.' });
      const reason =
        text(req.body.reason, 500) || 'Encerramento pelo Super Admin';
      const [market] =
        await sql`WITH changed AS (UPDATE nexo.markets SET active=false,status='cancelado',updated_date=now() WHERE id=${id} AND status<>'cancelado' RETURNING *),subscriptions AS (UPDATE nexo.subscriptions SET status='cancelada',cancelled_at=now(),cancellation_reason=${reason},updated_date=now() WHERE market_id=${id} AND status IN ('teste','ativa','inadimplente','suspensa')),log AS (INSERT INTO nexo.market_change_log(market_id,actor_id,action,details) SELECT id,${user.id},'mercado_encerrado',jsonb_build_object('reason',${reason}) FROM changed) SELECT * FROM changed`;
      return send(
        res,
        market ? 200 : 404,
        market || { message: 'Mercadinho não encontrado ou já encerrado.' },
      );
    }
  }
}
