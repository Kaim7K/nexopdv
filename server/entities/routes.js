import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { roundMoney } from '../cash-summary.js';
import { normalizeCashClosingTime } from '../cash-access.js';
import { send } from '../http.js';

export async function handleEntityRequest(
  { req, res, sql, user, path },
  {
    ENTITIES,
    USER_ROLES,
    CONFIG_FEATURES,
    assertProductBarcodeAvailable,
    findOpenCashSession,
    hasFeature,
    isUuid,
    matchesFilter,
    normalizeAuditPayload,
    normalizeImageValue,
    normalizeProductPayload,
    parseFiltersQuery,
    text,
    validateProductPayload,
  },
) {
  const table = ENTITIES[path[1]];
  if (!table) return send(res, 404, { message: 'Entidade desconhecida.' });
  const id = path[2];
  if (
    ['sales', 'cash_sessions'].includes(table) &&
    req.method !== 'GET'
  )
    return send(res, 405, {
      message:
        'Este registro financeiro só pode ser alterado pelo fluxo operacional correspondente.',
    });
  if (table === 'users') {
    if (!['admin', 'gerente'].includes(user.role))
      return send(res, 403, {
        message: 'Sem permissão para gerenciar usuários.',
      });
    if (req.method === 'GET')
      return send(
        res,
        200,
        await sql`SELECT id,email,full_name,role,photo_url,active,cash_closing_time_enabled,to_char(cash_closing_min_time,'HH24:MI') AS cash_closing_min_time,created_date,updated_date FROM nexo.users WHERE market_id=${user.market_id} AND active=true ORDER BY full_name NULLS LAST,email`,
      );
    if (req.method === 'DELETE') {
      if (!isUuid(id))
        return send(res, 400, { message: 'Usuário inválido.' });
      if (id === user.id)
        return send(res, 400, {
          message: 'Você não pode excluir o próprio usuário.',
        });
      const [target] =
        await sql`SELECT id,email,full_name,role FROM nexo.users WHERE id=${id} AND market_id=${user.market_id} AND active=true`;
      if (!target)
        return send(res, 404, { message: 'Usuário não encontrado.' });
      if (user.role === 'gerente' && target.role !== 'vendedor')
        return send(res, 403, {
          message: 'Gerentes podem excluir apenas usuários vendedores.',
        });
      if (target.role === 'admin') {
        const [state] =
          await sql`SELECT count(*)::int AS active_admins FROM nexo.users WHERE market_id=${user.market_id} AND role='admin' AND active=true`;
        if (Number(state?.active_admins || 0) <= 1)
          return send(res, 409, {
            message: 'Mantenha pelo menos um administrador ativo no mercado.',
          });
      }
      const deletedEmail = `deleted+${String(id).replace(/-/g, '')}@nexo.invalid`;
      const deletedName = `${target.full_name || target.email} (excluído)`;
      const revokedPasswordHash = await bcrypt.hash(randomUUID(), 10);
      const auditPayload = {
        action_type: 'usuario_excluido',
        entity_type: 'user',
        entity_id: id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        description: `Usuário ${target.full_name || target.email} excluído`,
        details: {
          email: target.email,
          role: target.role,
          method: 'soft_delete',
        },
      };

      // A desativação e a auditoria permanecem atômicas, mas sem depender
      // de aliases externos no RETURNING. Essa forma é compatível com o
      // driver serverless do Neon e evita o erro 500 observado na exclusão.
      const [disabledRows] = await sql.transaction((tx) => [
        tx`
          UPDATE nexo.users
          SET active=false,
              email=${deletedEmail},
              full_name=${deletedName},
              photo_url=NULL,
              password_hash=${revokedPasswordHash},
              updated_date=now()
          WHERE id=${id}
            AND market_id=${user.market_id}
            AND active=true
          RETURNING id
        `,
        tx`
          INSERT INTO nexo.records(market_id,entity,data)
          SELECT ${user.market_id},'general_audits',${JSON.stringify(auditPayload)}::jsonb
          WHERE EXISTS (
            SELECT 1
            FROM nexo.users
            WHERE id=${id}
              AND market_id=${user.market_id}
              AND active=false
              AND email=${deletedEmail}
          )
          RETURNING id
        `,
      ]);
      if (!disabledRows?.[0])
        return send(res, 409, {
          message: 'O usuário já foi excluído ou está inativo.',
        });
      return send(res, 200, { ok: true });
    }
    if (req.method === 'PATCH') {
      if (!isUuid(id))
        return send(res, 400, { message: 'Usuário inválido.' });
      if (req.body.role && !USER_ROLES.includes(req.body.role))
        return send(res, 400, { message: 'Perfil de usuário inválido.' });
      if (id === user.id && req.body.active === false)
        return send(res, 400, {
          message: 'Você não pode desativar o próprio acesso.',
        });
      const [target] =
        await sql`SELECT id,role,cash_closing_time_enabled,to_char(cash_closing_min_time,'HH24:MI') AS cash_closing_min_time FROM nexo.users WHERE id=${id} AND market_id=${user.market_id} AND active=true`;
      if (!target)
        return send(res, 404, { message: 'Usuário não encontrado.' });
      if (user.role === 'gerente') {
        if (target.id !== user.id && target.role !== 'vendedor')
          return send(res, 403, {
            message: 'Gerentes podem alterar apenas usuários vendedores.',
          });
        if (req.body.role && req.body.role !== target.role)
          return send(res, 403, {
            message: 'Gerentes não podem alterar perfis de acesso.',
          });
        if (target.id === user.id && typeof req.body.active === 'boolean')
          return send(res, 403, {
            message: 'Gerentes não podem alterar o próprio status.',
          });
      }
      const fullName =
        req.body.full_name === undefined
          ? null
          : text(req.body.full_name, 180);
      if (req.body.full_name !== undefined && !fullName)
        return send(res, 400, { message: 'Nome do usuário é obrigatório.' });
      const photoUrl =
        req.body.photo_url === undefined
          ? null
          : normalizeImageValue(req.body.photo_url);
      const closingTime =
        req.body.cash_closing_min_time === undefined
          ? undefined
          : normalizeCashClosingTime(req.body.cash_closing_min_time);
      const resolvedClosingTime =
        closingTime === undefined
          ? normalizeCashClosingTime(target.cash_closing_min_time)
          : closingTime;
      const resolvedClosingTimeEnabled =
        typeof req.body.cash_closing_time_enabled === 'boolean'
          ? req.body.cash_closing_time_enabled
          : Boolean(target.cash_closing_time_enabled);
      if (resolvedClosingTimeEnabled && !resolvedClosingTime)
        return send(res, 400, {
          message: 'Informe um horário mínimo válido para fechar o caixa.',
        });
      if (
        req.body.cash_closing_time_enabled !== undefined &&
        typeof req.body.cash_closing_time_enabled !== 'boolean'
      )
        return send(res, 400, {
          message: 'Configuração de horário de fechamento inválida.',
        });
      const [u] =
        await sql`UPDATE nexo.users SET role=COALESCE(${req.body.role || null},role),full_name=COALESCE(${fullName},full_name),photo_url=COALESCE(${photoUrl},photo_url),active=COALESCE(${typeof req.body.active === 'boolean' ? req.body.active : null},active),cash_closing_time_enabled=COALESCE(${typeof req.body.cash_closing_time_enabled === 'boolean' ? req.body.cash_closing_time_enabled : null},cash_closing_time_enabled),cash_closing_min_time=CASE WHEN ${closingTime !== undefined} THEN ${closingTime}::time ELSE cash_closing_min_time END,updated_date=now() WHERE id=${id} AND market_id=${user.market_id} RETURNING id,email,full_name,role,photo_url,active,cash_closing_time_enabled,to_char(cash_closing_min_time,'HH24:MI') AS cash_closing_min_time`;
      return send(res, 200, u);
    }
  }
  if (table === 'markets')
    return send(res, 403, { message: 'Use o painel geral.' });
  if (table === 'cash_sessions')
    return send(res, 403, { message: 'Use as operações próprias de caixa.' });
  if (
    ['general_audits', 'product_audits'].includes(table) &&
    !['admin', 'gerente'].includes(user.role) &&
    req.method === 'GET'
  )
    return send(res, 403, {
      message: 'Sem permissão para consultar auditorias.',
    });
  if (
    ['general_audits', 'product_audits'].includes(table) &&
    !['GET', 'POST'].includes(req.method)
  )
    return send(res, 405, {
      message: 'Registros de auditoria não podem ser alterados ou excluídos.',
    });
  if (
    table === 'system_configs' &&
    !['admin', 'gerente'].includes(user.role) &&
    req.method !== 'GET'
  )
    return send(res, 403, {
      message: 'Sem permissão para alterar configurações.',
    });
  if (table === 'fiado_records' && req.method === 'POST')
    return send(res, 405, {
      message: 'Fiados são criados automaticamente ao concluir uma venda.',
    });
  if (table === 'fiado_records' && req.method === 'DELETE') {
    if (!['admin', 'gerente'].includes(user.role))
      return send(res, 403, {
        message:
          'Apenas administradores e gerentes podem arquivar fiados encerrados.',
      });
    if (!isUuid(id))
      return send(res, 400, { message: 'Identificador inválido.' });
    const [current] = await sql`
      SELECT id,data
      FROM nexo.records
      WHERE id=${id} AND market_id=${user.market_id} AND entity='fiado_records'
    `;
    if (!current)
      return send(res, 404, {
        message: 'Fiado não encontrado ou já arquivado.',
      });
    if (!['quitado', 'cancelado'].includes(current.data.status))
      return send(res, 409, {
        message: 'Só é possível arquivar fiados já quitados ou cancelados.',
      });
    const archivedAt = new Date().toISOString();
    const [archived] = await sql`
      WITH archived AS (
        UPDATE nexo.records
        SET data=data || jsonb_build_object(
          'archived',true,'archived_at',${archivedAt}::text,
          'archived_by_id',${user.id}::text,
          'archived_by_name',${user.full_name || user.email}::text
        ),updated_date=now()
        WHERE id=${id} AND market_id=${user.market_id} AND entity='fiado_records'
          AND COALESCE((data->>'archived')::boolean,false)=false
        RETURNING id,data
      ), audit AS (
        INSERT INTO nexo.records(market_id,entity,data)
        SELECT ${user.market_id},'general_audits',jsonb_build_object(
          'action_type','fiado_arquivado','entity_type','fiado','entity_id',archived.id,
          'user_id',${user.id}::text,'user_name',${user.full_name || user.email}::text,
          'description','Fiado #'||COALESCE(archived.data->>'sale_number','sem número')||' arquivado',
          'details',jsonb_build_object(
            'responsible_name',archived.data->>'responsible_name',
            'status',archived.data->>'status','total_amount',archived.data->'total_amount',
            'archived_at',${archivedAt}::text
          )
        FROM archived
      )
      SELECT * FROM archived
    `;
    if (!archived)
      return send(res, 404, {
        message: 'Fiado não encontrado ou já arquivado.',
      });
    return send(res, 200, { ok: true, archived: true });
  }
  if (
    table === 'products' &&
    req.method === 'DELETE' &&
    !['admin', 'gerente'].includes(user.role)
  )
    return send(res, 403, {
      message: 'Sem permissão para excluir produtos.',
    });
  if (table === 'system_configs' && req.method === 'DELETE')
    return send(res, 405, {
      message: 'Configurações não podem ser excluídas por esta operação.',
    });
  if (table === 'sales' && ['POST', 'PATCH', 'DELETE'].includes(req.method))
    return send(res, 405, {
      message: 'Use as operações próprias de vendas.',
    });
  if (req.method === 'GET' && id) {
    if (!isUuid(id))
      return send(res, 400, { message: 'Identificador inválido.' });
    const rows =
      await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE id=${id} AND market_id=${user.market_id} AND entity=${table}`;
    const record = rows[0]
      ? {
          id: rows[0].id,
          ...rows[0].data,
          created_date: rows[0].created_date,
          updated_date: rows[0].updated_date,
        }
      : null;
    if (
      record &&
      user.role === 'vendedor' &&
      table === 'sales' &&
      record.seller_id !== user.id
    )
      return send(res, 403, {
        message: 'Sem permissão para acessar este registro.',
      });
    return send(
      res,
      record ? 200 : 404,
      record || { message: 'Registro não encontrado.' },
    );
  }
  if (req.method === 'GET') {
    const maxLimit = table === 'sales' ? 5000 : 1000;
    const limit = Math.max(
      1,
      Math.min(Number(req.query.limit) || 500, maxLimit),
    );
    const rows =
      await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${user.market_id} AND entity=${table} ORDER BY updated_date DESC LIMIT ${limit}`;
    let out = rows.map((r) => ({
      id: r.id,
      ...r.data,
      created_date: r.created_date,
      updated_date: r.updated_date,
    }));
    if (
      user.role === 'vendedor' &&
      table === 'sales'
    )
      out = out.filter((record) => record.seller_id === user.id);
    const f = parseFiltersQuery(req.query.filters);
    if (f) {
      out = out.filter((r) =>
        Object.entries(f).every(([k, v]) => matchesFilter(r, k, v)),
      );
    }
    const sort = req.query.sort;
    if (sort) {
      const desc = sort.startsWith('-'),
        key = sort.replace(/^-/, '');
      out.sort((a, b) => (a[key] > b[key] ? 1 : -1) * (desc ? -1 : 1));
    }
    return send(res, 200, out);
  }
  if (req.method === 'POST') {
    let recordPayload = req.body;
    if (table === 'products') {
      if (req.body?.image_url && !hasFeature(user, 'product_image_upload'))
        return send(res, 403, {
          code: 'FEATURE_NOT_AVAILABLE',
          message: 'Imagens de produtos não estão incluídas neste plano.',
        });
      recordPayload = normalizeProductPayload(req.body);
      validateProductPayload(recordPayload);
      await assertProductBarcodeAvailable(
        sql,
        user.market_id,
        recordPayload.barcode,
      );
      const [capacity] =
        await sql`SELECT market.product_limit,(SELECT count(*)::int FROM nexo.records WHERE market_id=market.id AND entity='products') AS product_count FROM nexo.markets market WHERE market.id=${user.market_id}`;
      if (
        capacity?.product_limit &&
        Number(capacity.product_count) >= Number(capacity.product_limit)
      )
        return send(res, 409, {
          code: 'PRODUCT_LIMIT_REACHED',
          message: 'O limite de produtos do plano foi atingido.',
        });
    }
    if (['general_audits', 'product_audits'].includes(table))
      recordPayload = normalizeAuditPayload(req.body, user, table);
    if (table === 'system_configs') {
      recordPayload = {
        key: text(req.body.key, 100),
        value: String(req.body.value || '').startsWith('data:image/')
          ? normalizeImageValue(req.body.value)
          : text(req.body.value, 5000),
      };
      if (!recordPayload.key)
        return send(res, 400, { message: 'Chave de configuração inválida.' });
      const requiredFeature = CONFIG_FEATURES[recordPayload.key];
      if (requiredFeature && !hasFeature(user, requiredFeature))
        return send(res, 403, {
          code: 'FEATURE_NOT_AVAILABLE',
          message:
            'Este recurso de personalização não está incluído no plano.',
        });
      const [existing] =
        await sql`UPDATE nexo.records SET data=data || ${JSON.stringify(recordPayload)}::jsonb,updated_date=now() WHERE market_id=${user.market_id} AND entity='system_configs' AND data->>'key'=${recordPayload.key} RETURNING id,data,created_date,updated_date`;
      if (existing)
        return send(res, 200, {
          id: existing.id,
          ...existing.data,
          created_date: existing.created_date,
          updated_date: existing.updated_date,
        });
    }
    const [r] =
      await sql`INSERT INTO nexo.records(market_id,entity,data) VALUES(${user.market_id},${table},${JSON.stringify(recordPayload)}::jsonb) RETURNING id,data,created_date,updated_date`;
    return send(res, 201, {
      id: r.id,
      ...r.data,
      created_date: r.created_date,
      updated_date: r.updated_date,
    });
  }
  if (table === 'fiado_records' && req.method === 'PATCH') {
    if (!isUuid(id))
      return send(res, 400, { message: 'Identificador inválido.' });
    const allowedFields = new Set([
      'status',
      'settlement_date',
      'settlement_method',
      'settled_by_id',
      'settled_by_name',
      'cancellation_reason',
    ]);
    const invalidFields = Object.keys(req.body || {}).filter(
      (key) => !allowedFields.has(key),
    );
    if (invalidFields.length)
      return send(res, 400, {
        message: 'A alteração contém campos não permitidos.',
      });
    if (!['pendente', 'quitado', 'cancelado'].includes(req.body.status))
      return send(res, 400, {
        message: 'O fiado só pode ser quitado, cancelado ou reaberto.',
      });
    if (
      req.body.status === 'quitado' &&
      !['dinheiro', 'pix', 'debito', 'credito', 'outros'].includes(
        req.body.settlement_method,
      )
    )
      return send(res, 400, { message: 'Forma de quitação inválida.' });
    const sellerOnly = user.role === 'vendedor';
    const [current] =
      await sql`SELECT id,data FROM nexo.records WHERE id=${id} AND market_id=${user.market_id} AND entity='fiado_records' AND (${!sellerOnly} OR data->>'seller_id'=${user.id})`;
    if (!current)
      return send(res, 404, {
        message: 'Fiado não encontrado ou sem permissão.',
      });
    const isReopening = req.body.status === 'pendente';
    if (isReopening) {
      if (current.data.status !== 'quitado')
        return send(res, 409, {
          message: 'Somente fiados quitados podem ser reabertos.',
        });
    } else if (current.data.status !== 'pendente') {
      return send(res, 409, {
        message: 'Somente fiados pendentes podem ser quitados ou cancelados.',
      });
    }
    const fiadoUpdate = isReopening
      ? {
          status: 'pendente',
          settlement_date: null,
          settlement_method: null,
          settled_by_id: null,
          settled_by_name: null,
          cancellation_reason: null,
        }
      : {
          status: req.body.status,
          settled_by_id: user.id,
          settled_by_name: user.full_name || user.email,
          ...(req.body.status === 'quitado'
            ? {
                settlement_date: new Date().toISOString(),
                settlement_method: req.body.settlement_method,
              }
            : { cancellation_reason: text(req.body.cancellation_reason, 500) }),
        };
    const settlesInCash =
      req.body.status === 'quitado' &&
      req.body.settlement_method === 'dinheiro';
    const openSession = settlesInCash
      ? await findOpenCashSession(sql, user.market_id, user.id)
      : null;
    const settlementAt = fiadoUpdate.settlement_date || new Date().toISOString();
    const cashMovementPayload = {
      cash_session_id: openSession?.id || null,
      type: 'entrada',
      amount: roundMoney(Number(current.data.total_amount || 0)),
      note: `Recebimento da venda fiada #${text(current.data.sale_number, 50) || 'sem número'}`,
      status: 'ativo',
      origin: 'fiado',
      fiado_settlement_id: id,
      sale_id: current.data.sale_id || null,
      sale_number: current.data.sale_number || null,
      responsible_name: text(current.data.responsible_name, 180),
      operator_id: user.id,
      operator_name: user.full_name || user.email,
      created_at: settlementAt,
    };
    const expectedStatus = isReopening ? 'quitado' : 'pendente';
    const actionType = isReopening
      ? 'fiado_quitacao_desfeita'
      : req.body.status === 'quitado'
        ? 'fiado_quitado'
        : 'fiado_cancelado';
    const actionDescription = isReopening
      ? `Quitação do fiado #${text(current.data.sale_number, 50) || 'sem número'} desfeita`
      : req.body.status === 'quitado'
        ? `Fiado #${text(current.data.sale_number, 50) || 'sem número'} quitado`
        : `Fiado #${text(current.data.sale_number, 50) || 'sem número'} cancelado`;
    const [r] = await sql`
      WITH movement AS (
        INSERT INTO nexo.records(market_id,entity,data)
        SELECT ${user.market_id},'cash_movements',${JSON.stringify(cashMovementPayload)}::jsonb
        WHERE ${Boolean(settlesInCash && openSession)}
        ON CONFLICT DO NOTHING
        RETURNING id
      ), reversed_movement AS (
        UPDATE nexo.records
        SET data=data || jsonb_build_object(
          'status','estornado','reversed_at',now(),'reversed_by',${user.id}::text,
          'reversal_reason','Quitação da venda fiada desfeita'
        ),updated_date=now()
        WHERE ${isReopening} AND market_id=${user.market_id} AND entity='cash_movements'
          AND id::text=${text(current.data.settlement_cash_movement_id, 64)}
        RETURNING id
      ), updated AS (
        UPDATE nexo.records
        SET data=data || ${JSON.stringify(fiadoUpdate)}::jsonb ||
          CASE WHEN ${Boolean(settlesInCash && openSession)} THEN jsonb_build_object(
            'settlement_cash_session_id',${openSession?.id || null}::text,
            'settlement_cash_movement_id',(SELECT id::text FROM movement LIMIT 1)
          ) ELSE jsonb_build_object(
            'settlement_cash_session_id',NULL,
            'settlement_cash_movement_id',NULL
          ) END,
          updated_date=now()
        WHERE id=${id} AND market_id=${user.market_id} AND entity='fiado_records'
          AND data->>'status'=${expectedStatus}
        RETURNING id,data,created_date,updated_date
      ), audit AS (
        INSERT INTO nexo.records(market_id,entity,data)
        SELECT ${user.market_id},'general_audits',jsonb_build_object(
          'action_type',${actionType}::text,'entity_type','fiado','entity_id',updated.id,
          'user_id',${user.id}::uuid,'user_name',${user.full_name || user.email}::text,
          'description',${actionDescription}::text,'details',jsonb_build_object(
            'previous_status',${current.data.status || null}::text,
            'status',updated.data->>'status','total_amount',updated.data->'total_amount',
            'settlement_method',updated.data->'settlement_method',
            'cash_session_id',updated.data->'settlement_cash_session_id'
          )
        ) FROM updated
      )
      SELECT * FROM updated
    `;
    if (!r)
      return send(res, 409, {
        message: 'Este fiado já foi alterado em outra tela. Atualize a página para conferir o status atual.',
      });
    return send(res, 200, {
      id: r.id,
      ...r.data,
      created_date: r.created_date,
      updated_date: r.updated_date,
    });
  }
  if (req.method === 'PATCH') {
    if (!isUuid(id))
      return send(res, 400, { message: 'Identificador inválido.' });
    let recordPayload = req.body;
    if (table === 'products') {
      if (
        req.body?.image_url !== undefined &&
        !hasFeature(user, 'product_image_upload')
      )
        return send(res, 403, {
          code: 'FEATURE_NOT_AVAILABLE',
          message: 'Imagens de produtos não estão incluídas neste plano.',
        });
      recordPayload = normalizeProductPayload(req.body, true);
      validateProductPayload(recordPayload, true);
      if (recordPayload.barcode !== undefined)
        await assertProductBarcodeAvailable(
          sql,
          user.market_id,
          recordPayload.barcode,
          id,
        );
    }
    if (table === 'system_configs') {
      const [currentConfig] =
        await sql`SELECT data->>'key' AS key FROM nexo.records WHERE id=${id} AND market_id=${user.market_id} AND entity='system_configs'`;
      const requiredFeature = CONFIG_FEATURES[currentConfig?.key];
      if (requiredFeature && !hasFeature(user, requiredFeature))
        return send(res, 403, {
          code: 'FEATURE_NOT_AVAILABLE',
          message:
            'Este recurso de personalização não está incluído no plano.',
        });
      recordPayload = {
        value: String(req.body.value || '').startsWith('data:image/')
          ? normalizeImageValue(req.body.value)
          : text(req.body.value, 5000),
      };
    }
    const [r] =
      await sql`UPDATE nexo.records SET data=data || ${JSON.stringify(recordPayload)}::jsonb,updated_date=now() WHERE id=${id} AND market_id=${user.market_id} AND entity=${table} RETURNING id,data,created_date,updated_date`;
    return send(
      res,
      r ? 200 : 404,
      r
        ? {
            id: r.id,
            ...r.data,
            created_date: r.created_date,
            updated_date: r.updated_date,
          }
        : { message: 'Registro não encontrado.' },
    );
  }
  if (table === 'products' && req.method === 'DELETE') {
    if (!isUuid(id)) return send(res, 400, { message: 'Produto inválido.' });
    const [removed] = await sql`
      DELETE FROM nexo.records
      WHERE id=${id} AND market_id=${user.market_id} AND entity='products'
      RETURNING id,data
    `;
    if (!removed)
      return send(res, 404, {
        message: 'Produto não encontrado ou já excluído.',
      });
    try {
      const auditData = {
        action_type: 'produto_excluido',
        entity_type: 'product',
        entity_id: removed.id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        description: `Produto ${text(removed.data?.name, 180) || 'sem nome'} excluído do estoque`,
        details: {
          barcode: text(removed.data?.barcode, 180),
          internal_code: text(removed.data?.internal_code, 180),
        },
      };
      await sql`INSERT INTO nexo.records(market_id,entity,data) VALUES(${user.market_id},'general_audits',${JSON.stringify(auditData)}::jsonb)`;
    } catch (auditError) {
      console.error(
        'Falha ao auditar exclusão de produto:',
        auditError?.message,
      );
    }
    return send(res, 200, { ok: true });
  }
  if (req.method === 'DELETE') {
    if (!isUuid(id))
      return send(res, 400, { message: 'Identificador inválido.' });
    await sql`DELETE FROM nexo.records WHERE id=${id} AND market_id=${user.market_id} AND entity=${table}`;
    return send(res, 200, { ok: true });
  }
}
