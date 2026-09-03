import { randomUUID } from 'node:crypto';
import { roundMoney } from '../cash-summary.js';
import {
  cashClosingAvailability,
  cashSessionForUser,
  cashSummaryForUser,
} from '../cash-access.js';
import { methodNotAllowed, send } from '../http.js';

export async function handleCashRequest(
  { req, res, sql, user, path },
  {
    cashClosingEntryQuery,
    cashClosingExpenseQuery,
    ensureCashFinanceReferences,
    findOpenCashSession,
    getCashSessionSummary,
    getCashSessionsSummaries,
    isUuid,
    parseDateQuery,
    recordFromRow,
    text,
  },
) {
  if (path[0] === 'cash') {
    if (!user.market_id)
      return send(res, 400, { message: 'Usuário sem mercado vinculado.' });

    if (path[1] === 'history' && req.method === 'GET') {
      if (user.role === 'vendedor')
        return send(res, 403, {
          message: 'O histórico de caixas é restrito a gerentes e administradores.',
        });
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const pageSize = Math.max(
        10,
        Math.min(Number.parseInt(req.query.page_size, 10) || 20, 100),
      );
      const offset = (page - 1) * pageSize;
      const from = parseDateQuery(req.query.from);
      const to = parseDateQuery(req.query.to);
      const sellerId =
        user.role === 'vendedor' ? user.id : text(req.query.operator_id, 64);
      const status = text(req.query.status, 30);
      const unitId = text(req.query.unit_id, 64);
      const rows = await sql`
        SELECT id,data,created_date,updated_date,count(*) OVER()::int AS total_count
        FROM nexo.records
        WHERE market_id=${user.market_id} AND entity='cash_sessions'
          AND (${from === null} OR COALESCE(NULLIF(data->>'opened_at','')::timestamptz,created_date) >= ${from})
          AND (${to === null} OR COALESCE(NULLIF(data->>'opened_at','')::timestamptz,created_date) < ${to})
          AND (${sellerId === ''} OR data->>'seller_id'=${sellerId})
          AND (${status === ''} OR data->>'status'=${status})
          AND (${unitId === ''} OR data->>'unit_id'=${unitId})
        ORDER BY COALESCE(NULLIF(data->>'opened_at','')::timestamptz,created_date) DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      const sessions = rows.map(recordFromRow);
      const summaries = await getCashSessionsSummaries(
        sql,
        user.market_id,
        sessions,
      );
      const items = [];
      for (const session of sessions) {
        const summary = summaries.get(String(session.id)) || {};
        const item = {
          ...session,
          summary,
          total_sales: Number(summary.total || 0),
          entries: Number(summary.entries || 0),
          withdrawals: Number(summary.withdrawals || 0),
          payments: summary.payments || {},
          final_amount: session.closing_amount ?? summary.expected_cash ?? 0,
          difference:
            session.status === 'fechado' &&
            session.closing_amount !== null &&
            session.closing_amount !== undefined
              ? roundMoney(
                  Number(session.closing_amount || 0) -
                    Number(summary.expected_cash || 0),
                )
              : null,
        };
        items.push(
          user.role === 'vendedor'
            ? {
                ...cashSessionForUser(user, session),
                summary: cashSummaryForUser(user, summary),
                sales_count: Number(summary.sales_count || 0),
              }
            : item,
        );
      }
      const [operatorRows, unitRows] = await Promise.all([
        user.role === 'vendedor'
          ? [{ id: user.id, name: user.full_name || user.email }]
          : sql`SELECT id,COALESCE(full_name,email) AS name FROM nexo.users WHERE market_id=${user.market_id} ORDER BY COALESCE(full_name,email)`,
        sql`SELECT id,name,code,active FROM nexo.market_units WHERE market_id=${user.market_id} ORDER BY name`,
      ]);
      const total = Number(rows[0]?.total_count || 0);
      return send(res, 200, {
        items,
        page,
        page_size: pageSize,
        total,
        page_count: Math.max(1, Math.ceil(total / pageSize)),
        operators: operatorRows,
        units: unitRows,
      });
    }

    if (isUuid(path[1]) && !path[2] && req.method === 'GET') {
      if (user.role === 'vendedor')
        return send(res, 403, {
          message: 'Os detalhes do histórico de caixas são restritos a gerentes e administradores.',
        });
      const [row] =
        await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE id=${path[1]} AND market_id=${user.market_id} AND entity='cash_sessions' AND (${user.role !== 'vendedor'} OR data->>'seller_id'=${user.id})`;
      if (!row)
        return send(res, 404, {
          message: 'Caixa não encontrado ou sem permissão.',
        });
      const session = recordFromRow(row);
      return send(res, 200, {
        session: cashSessionForUser(user, session),
        summary: cashSummaryForUser(
          user,
          await getCashSessionSummary(sql, user.market_id, session),
        ),
      });
    }

    if (isUuid(path[1]) && !path[2] && req.method === 'PATCH') {
      if (user.role !== 'admin')
        return send(res, 403, {
          message: 'Apenas administradores podem editar ou reabrir um caixa.',
        });
      const allowedFields = new Set([
        'status',
        'opening_amount',
        'closing_amount',
        'closing_entry',
        'closing_expense',
      ]);
      const invalidFields = Object.keys(req.body || {}).filter(
        (key) => !allowedFields.has(key),
      );
      if (invalidFields.length)
        return send(res, 400, {
          message: 'A edição contém campos não permitidos.',
        });
      const [row] =
        await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE id=${path[1]} AND market_id=${user.market_id} AND entity='cash_sessions'`;
      if (!row)
        return send(res, 404, {
          message: 'Caixa não encontrado.',
        });
      const current = recordFromRow(row);
      if (current.status !== 'fechado')
        return send(res, 409, {
          message: 'Somente caixas fechados podem ser reabertos ou editados.',
        });

      const nextStatus = text(req.body.status, 20) || current.status;
      if (!['aberto', 'fechado'].includes(nextStatus))
        return send(res, 400, { message: 'Status de caixa inválido.' });
      if (nextStatus === 'aberto') {
        const [otherOpenSession] = await sql`
          SELECT id FROM nexo.records
          WHERE market_id=${user.market_id} AND entity='cash_sessions'
            AND data->>'seller_id'=${current.seller_id}
            AND data->>'status'='aberto' AND id<>${current.id}
          LIMIT 1
        `;
        if (otherOpenSession)
          return send(res, 409, {
            message:
              'Este operador já possui outro caixa aberto. Feche-o antes de reabrir este caixa.',
          });
      }

      const openingAmount =
        req.body.opening_amount === undefined
          ? roundMoney(Number(current.opening_amount || 0))
          : roundMoney(Number(req.body.opening_amount));
      if (
        !Number.isFinite(openingAmount) ||
        openingAmount < 0 ||
        openingAmount > 10_000_000
      )
        return send(res, 400, {
          message: 'Informe um valor inicial válido.',
        });

      const summary = await getCashSessionSummary(sql, user.market_id, {
        ...current,
        opening_amount: openingAmount,
      });

      const closingAmount =
        nextStatus === 'aberto'
          ? null
          : req.body.closing_amount === undefined
            ? (current.closing_amount === null || current.closing_amount === undefined
                ? null
                : roundMoney(Number(current.closing_amount)))
            : roundMoney(Number(req.body.closing_amount));
      const closingExpense =
        nextStatus === 'aberto'
          ? 0
          : req.body.closing_expense === undefined
            ? roundMoney(Number(current.closing_expense || 0))
            : roundMoney(Number(req.body.closing_expense));
      const closingEntry =
        nextStatus === 'aberto'
          ? 0
          : req.body.closing_entry === undefined
            ? roundMoney(Number(current.closing_entry || 0))
            : roundMoney(Number(req.body.closing_entry));
      if (
        closingAmount !== null &&
        (!Number.isFinite(closingAmount) ||
          closingAmount < 0 ||
          closingAmount > 10_000_000)
      )
        return send(res, 400, {
          message: 'Informe um valor de fechamento válido.',
        });
      if (
        !Number.isFinite(closingExpense) ||
        closingExpense < 0 ||
        closingExpense > 10_000_000
      )
        return send(res, 400, {
          message: 'Informe uma despesa de fechamento válida.',
        });

      if (
        !Number.isFinite(closingEntry) ||
        closingEntry < 0 ||
        closingEntry > 10_000_000
      )
        return send(res, 400, {
          message: 'Informe uma entrada de fechamento válida.',
        });

      const baseExpectedCash = roundMoney(
        Number(
          summary.expected_cash_before_expense ?? summary.expected_cash ?? 0,
        ),
      );
      const adjustedExpectedCash = roundMoney(
        baseExpectedCash +
          (nextStatus === 'aberto' ? 0 : closingEntry) -
          (nextStatus === 'aberto' ? 0 : closingExpense),
      );
      const update =
        nextStatus === 'aberto'
          ? {
              status: 'aberto',
              opening_amount: openingAmount,
              closed_at: null,
              closing_amount: null,
              closing_entry: null,
              closing_expense: null,
              difference: null,
            }
          : {
              status: 'fechado',
              opening_amount: openingAmount,
              closed_at: current.closed_at || new Date().toISOString(),
              closing_amount: closingAmount,
              closing_entry: closingEntry || null,
              closing_expense: closingExpense || null,
              difference:
                closingAmount === null
                  ? null
                  : roundMoney(closingAmount - adjustedExpectedCash),
              summary: {
                ...summary,
                closing_entry: closingEntry || 0,
                closing_expense: closingExpense || 0,
                expected_cash_before_expense: baseExpectedCash,
                expected_cash: adjustedExpectedCash,
              },
            };

      const occurredAt = current.closed_at || new Date().toISOString();
      const financialOperationId = randomUUID();
      update.financial_operation_id = financialOperationId;
      const financeReferences =
        nextStatus === 'fechado' && (closingExpense > 0 || closingEntry > 0)
          ? await ensureCashFinanceReferences(sql, user)
          : {};
      const auditPayload = {
        action_type: nextStatus === 'aberto' ? 'caixa_reaberto' : 'caixa_editado',
        entity_type: 'cash_session',
        entity_id: path[1],
        user_id: user.id,
        user_name: user.full_name || user.email,
        description:
          nextStatus === 'aberto'
            ? `Caixa de ${current.seller_name} reaberto`
            : `Caixa de ${current.seller_name} editado`,
        details: {
          previous_status: current.status,
          next_status: nextStatus,
          opening_amount: openingAmount,
          closing_amount: closingAmount,
          closing_entry: nextStatus === 'aberto' ? 0 : closingEntry || 0,
          closing_expense: nextStatus === 'aberto' ? 0 : closingExpense || 0,
        },
      };
      const [updatedRows] = await sql.transaction((tx) => [
        tx`UPDATE nexo.records SET data=data || ${JSON.stringify(update)}::jsonb,updated_date=now() WHERE id=${path[1]} AND market_id=${user.market_id} AND entity='cash_sessions' AND data->>'status'='fechado' RETURNING id,data,created_date,updated_date`,
        cashClosingExpenseQuery(
          tx,
          user,
          current,
          nextStatus === 'fechado' ? closingExpense : 0,
          occurredAt,
          financeReferences,
          nextStatus,
          financialOperationId,
        ),
        cashClosingEntryQuery(
          tx,
          user,
          current,
          nextStatus === 'fechado' ? closingEntry : 0,
          occurredAt,
          financeReferences,
          nextStatus,
          financialOperationId,
        ),
        tx`INSERT INTO nexo.records(market_id,entity,data) SELECT ${user.market_id},'general_audits',${JSON.stringify(auditPayload)}::jsonb WHERE EXISTS (SELECT 1 FROM nexo.records WHERE id=${path[1]} AND market_id=${user.market_id} AND entity='cash_sessions' AND data->>'status'=${nextStatus} AND data->>'financial_operation_id'=${financialOperationId})`,
      ]);
      const updated = updatedRows?.[0];
      if (!updated)
        return send(res, 409, {
          message: 'O caixa foi alterado em outra tela. Atualize e tente novamente.',
        });
      const session = recordFromRow(updated);
      return send(res, 200, {
        session,
        summary: await getCashSessionSummary(sql, user.market_id, session),
      });
    }

    if (isUuid(path[1]) && !path[2] && req.method === 'DELETE') {
      if (user.role !== 'admin')
        return send(res, 403, {
          message:
            'Apenas administradores podem excluir um caixa individualmente.',
        });
      const [row] =
        await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE id=${path[1]} AND market_id=${user.market_id} AND entity='cash_sessions'`;
      if (!row)
        return send(res, 404, {
          message: 'Caixa não encontrado.',
        });
      const session = recordFromRow(row);
      if (session.status === 'aberto')
        return send(res, 409, {
          message: 'Feche o caixa antes de excluí-lo.',
        });
      const [linkedSales] = await sql`
        SELECT count(*)::int AS count FROM nexo.records
        WHERE market_id=${user.market_id} AND entity='sales'
          AND data->>'cash_session_id'=${session.id}
      `;
      if (Number(linkedSales?.count || 0) > 0)
        return send(res, 409, {
          message:
            'Este caixa possui vendas vinculadas e não pode ser excluído. Mantenha-o no histórico para preservar a conferência e a auditoria.',
        });

      const deletedAt = new Date().toISOString();
      const deletedRows = await sql.transaction((tx) => [
        tx`
          WITH reversed_transaction AS (
            UPDATE nexo.finance_transactions
            SET status='reversed',paid_amount=0,settled_at=NULL,cancelled_by=${user.id},
                cancelled_at=now(),cancellation_reason='Caixa excluído',updated_date=now()
            WHERE market_id=${user.market_id} AND (
              (origin IN ('cash_close','cash_close_entry') AND origin_id=${session.id}) OR
              (origin='cash_movement' AND origin_id IN (
                SELECT id FROM nexo.records WHERE market_id=${user.market_id}
                  AND entity='cash_movements' AND data->>'cash_session_id'=${session.id}
              ))
            )
              AND status NOT IN ('cancelled','reversed')
            RETURNING id,market_id
          ), reversed_payments AS (
            UPDATE nexo.finance_payments payment
            SET reversed_at=now(),reversed_by=${user.id},reversal_reason='Caixa excluído'
            FROM reversed_transaction transaction
            WHERE payment.transaction_id=transaction.id AND payment.reversed_at IS NULL
          )
          INSERT INTO nexo.finance_transaction_events(
            market_id,transaction_id,action,new_data,actor_id,actor_name
          )
          SELECT market_id,id,'cash_session_deleted',jsonb_build_object('cash_session_id',${session.id}::text),
                 ${user.id},${user.full_name || user.email}
          FROM reversed_transaction
        `,
        tx`
          DELETE FROM nexo.records
          WHERE market_id=${user.market_id}
            AND entity='cash_movements'
            AND data->>'cash_session_id'=${session.id}
        `,
        tx`
          DELETE FROM nexo.records
          WHERE id=${session.id}
            AND market_id=${user.market_id}
            AND entity='cash_sessions'
        `,
        tx`
          INSERT INTO nexo.records(market_id,entity,data)
          VALUES(
            ${user.market_id},
            'general_audits',
            ${JSON.stringify({
              action_type: 'caixa_excluido',
              entity_type: 'cash_session',
              entity_id: session.id,
              user_id: user.id,
              user_name: user.full_name || user.email,
              description: `Caixa de ${session.seller_name} excluído`,
              details: {
                status: session.status,
                opened_at: session.opened_at || session.created_date,
                closed_at: session.closed_at || null,
                deleted_at: deletedAt,
              },
            })}::jsonb
          )
        `,
      ]);

      return send(res, 200, {
        ok: true,
        deleted: {
          cash_sessions: Number(deletedRows?.[2]?.length || 0),
          cash_movements: Number(deletedRows?.[1]?.length || 0),
          general_audits: 0,
        },
      });
    }

    if (isUuid(path[1]) && path[2] === 'movements') {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      const type = text(req.body.type, 20);
      const amount = roundMoney(Number(req.body.amount));
      const note = text(req.body.note, 500);
      const operationId = isUuid(req.body.operation_id)
        ? req.body.operation_id
        : randomUUID();
      if (!['entrada', 'retirada'].includes(type))
        return send(res, 400, { message: 'Selecione entrada ou retirada.' });
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000)
        return send(res, 400, {
          message: 'Informe um valor de movimentação válido.',
        });
      const [sessionRow] =
        await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE id=${path[1]} AND market_id=${user.market_id} AND entity='cash_sessions' AND data->>'status'='aberto' AND data->>'seller_id'=${user.id}`;
      if (!sessionRow)
        return send(res, 409, {
          message:
            'Somente o operador responsável pode movimentar o próprio caixa aberto.',
        });
      const payload = {
        cash_session_id: path[1],
        type,
        amount,
        note,
        status: 'ativo',
        origin: 'manual',
        operation_id: operationId,
        operator_id: user.id,
        operator_name: user.full_name || user.email,
        created_at: new Date().toISOString(),
      };
      const { accountId } = await ensureCashFinanceReferences(sql, user);
      if (!accountId)
        return send(res, 409, {
          message:
            'Não foi possível vincular a movimentação à conta Caixa principal.',
        });
      const [movement] =
        await sql`
          WITH existing AS MATERIALIZED (
            SELECT id,data,created_date,updated_date FROM nexo.records
            WHERE market_id=${user.market_id} AND entity='cash_movements'
              AND data->>'operation_id'=${operationId} LIMIT 1
          ), movement AS (
            INSERT INTO nexo.records(market_id,entity,data)
            SELECT ${user.market_id},'cash_movements',${JSON.stringify(payload)}::jsonb
            WHERE NOT EXISTS (SELECT 1 FROM existing)
            ON CONFLICT DO NOTHING
            RETURNING id,data,created_date,updated_date
          ), finance_transaction AS (
            INSERT INTO nexo.finance_transactions(
              market_id,unit_id,account_id,type,description,amount,paid_amount,
              issue_date,due_date,settled_at,payment_method,status,origin,origin_id,notes,created_by
            )
            SELECT ${user.market_id},${user.unit_id || null},${accountId},'adjustment',
              ${type === 'entrada' ? 'Entrada manual no caixa' : 'Retirada manual do caixa'},
              ${amount},${amount},current_date,current_date,now(),'dinheiro','paid',
              'cash_movement',movement.id,${`cash_direction:${type}${note ? ` | ${note}` : ''}`},${user.id}
            FROM movement
            ON CONFLICT (market_id,origin,origin_id)
              WHERE origin='cash_movement' AND origin_id IS NOT NULL
            DO NOTHING
            RETURNING *
          ), finance_payment AS (
            INSERT INTO nexo.finance_payments(
              market_id,transaction_id,account_id,amount,paid_at,payment_method,notes,created_by
            )
            SELECT market_id,id,account_id,paid_amount,settled_at,payment_method,
              'Movimentação sincronizada com o caixa',${user.id}
            FROM finance_transaction
            RETURNING *
          ), linked_movement AS (
            UPDATE nexo.records record
            SET data=record.data||jsonb_build_object(
              'finance_transaction_id',finance_transaction.id::text,
              'finance_payment_id',finance_payment.id::text
            ),updated_date=now()
            FROM finance_transaction,finance_payment
            WHERE record.id=(SELECT id FROM movement LIMIT 1)
            RETURNING record.id,record.data,record.created_date,record.updated_date
          ), audit AS (
            INSERT INTO nexo.records(market_id,entity,data)
            SELECT ${user.market_id},'general_audits',jsonb_build_object(
              'action_type','movimentacao_caixa','entity_type','cash_session',
              'entity_id',${path[1]}::uuid,'user_id',${user.id}::uuid,
              'user_name',${user.full_name || user.email}::text,
              'description',${type === 'entrada' ? 'Entrada registrada no caixa' : 'Retirada registrada no caixa'}::text,
              'details',${JSON.stringify({ type, amount, note, operation_id: operationId })}::jsonb
            ) FROM movement
          ), result AS (
            SELECT * FROM linked_movement
            UNION ALL SELECT * FROM movement WHERE NOT EXISTS (SELECT 1 FROM linked_movement)
            UNION ALL SELECT * FROM existing
          )
          SELECT * FROM result LIMIT 1
        `;
      const session = recordFromRow(sessionRow);
      return send(res, 201, {
        movement: recordFromRow(movement),
        summary: cashSummaryForUser(
          user,
          await getCashSessionSummary(sql, user.market_id, session),
        ),
      });
    }

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

    if (path[1] === 'settings') {
      if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
      if (user.role !== 'admin')
        return send(res, 403, {
          message:
            'Apenas administradores podem alterar a exigência de abertura de caixa.',
        });
      if (typeof req.body.require_cash_register !== 'boolean')
        return send(res, 400, {
          message: 'Informe se a abertura de caixa deve ser obrigatória.',
        });
      const [market] = await sql`
        UPDATE nexo.markets
        SET require_cash_register=${req.body.require_cash_register}, updated_date=now()
        WHERE id=${user.market_id}
        RETURNING require_cash_register
      `;
      return send(res, 200, {
        require_cash_register: Boolean(market?.require_cash_register),
      });
    }

    if (path[1] === 'current') {
      if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
      const session = await findOpenCashSession(sql, user.market_id, user.id);
      const summary = session
        ? await getCashSessionSummary(sql, user.market_id, session)
        : null;
      const closingAvailability = cashClosingAvailability(user);
      return send(res, 200, {
        required:
          user.role === 'vendedor' && Boolean(user.require_cash_register),
        market_requires_cash: Boolean(user.require_cash_register),
        session: cashSessionForUser(user, session),
        summary: cashSummaryForUser(user, summary),
        closing_time: closingAvailability,
      });
    }

    if (path[1] === 'open') {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      if (!['vendedor', 'gerente', 'admin'].includes(user.role))
        return send(res, 403, {
          message: 'Este perfil não pode abrir um caixa.',
        });
      const openingAmount = roundMoney(Number(req.body.opening_amount));
      if (
        !Number.isFinite(openingAmount) ||
        openingAmount < 0 ||
        openingAmount > 10_000_000
      )
        return send(res, 400, { message: 'Informe um valor inicial válido.' });
      const current = await findOpenCashSession(sql, user.market_id, user.id);
      if (current)
        return send(res, 409, {
          message: 'Já existe um caixa aberto para este usuário.',
          session: cashSessionForUser(user, current),
        });
      const payload = {
        seller_id: user.id,
        seller_name: user.full_name || user.email,
        status: 'aberto',
        opening_amount: openingAmount,
        opened_at: new Date().toISOString(),
        unit_id: user.unit_id || null,
        unit_name: user.unit_name || 'Unidade principal',
      };
      const [row] = await sql`
        INSERT INTO nexo.records(market_id,entity,data)
        VALUES(${user.market_id},'cash_sessions',${JSON.stringify(payload)}::jsonb)
        ON CONFLICT DO NOTHING
        RETURNING id,data,created_date,updated_date
      `;
      if (!row)
        return send(res, 409, {
          message:
            'Já existe um caixa aberto para este usuário. Atualize a página.',
        });
      const session = recordFromRow(row);
      await sql`INSERT INTO nexo.records(market_id,entity,data) VALUES(
        ${user.market_id},'general_audits',${JSON.stringify({
          action_type: 'caixa_aberto',
          entity_type: 'cash_session',
          entity_id: session.id,
          user_id: user.id,
          user_name: user.full_name || user.email,
          description: `Caixa aberto com ${openingAmount.toFixed(2)}`,
          details: { opening_amount: openingAmount },
        })}::jsonb
      )`;
      return send(res, 201, {
        session: cashSessionForUser(user, session),
        summary: cashSummaryForUser(
          user,
          await getCashSessionSummary(sql, user.market_id, session),
        ),
      });
    }

    if (path[1] === 'close') {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      const closingAvailability = cashClosingAvailability(user);
      if (!closingAvailability.can_close)
        return send(res, 409, {
          code: 'CASH_CLOSING_TIME_RESTRICTED',
          message: closingAvailability.message,
          closing_time: closingAvailability,
        });
      const session = await findOpenCashSession(sql, user.market_id, user.id);
      if (!session)
        return send(res, 409, {
          message: 'Não existe caixa aberto para este usuário.',
        });
      const summary = await getCashSessionSummary(sql, user.market_id, session);
      const closingAmount =
        req.body.closing_amount === '' ||
        req.body.closing_amount === undefined ||
        req.body.closing_amount === null
          ? null
          : roundMoney(Number(req.body.closing_amount));
      const closingExpense =
        req.body.closing_expense === '' ||
        req.body.closing_expense === undefined ||
        req.body.closing_expense === null
          ? 0
          : roundMoney(Number(req.body.closing_expense));
      const closingEntry =
        req.body.closing_entry === '' ||
        req.body.closing_entry === undefined ||
        req.body.closing_entry === null
          ? 0
          : roundMoney(Number(req.body.closing_entry));
      if (
        closingAmount !== null &&
        (!Number.isFinite(closingAmount) ||
          closingAmount < 0 ||
          closingAmount > 10_000_000)
      )
        return send(res, 400, {
          message: 'Informe um valor de fechamento válido.',
        });
      if (
        !Number.isFinite(closingExpense) ||
        closingExpense < 0 ||
        closingExpense > 10_000_000
      )
        return send(res, 400, {
          message: 'Informe uma despesa de fechamento válida.',
        });
      if (
        !Number.isFinite(closingEntry) ||
        closingEntry < 0 ||
        closingEntry > 10_000_000
      )
        return send(res, 400, {
          message: 'Informe uma entrada de fechamento válida.',
        });
      const closedAt = new Date().toISOString();
      const {
        sales: cashSalesDetail,
        movements: cashMovementsDetail,
        filters: cashFilters,
        ...summarySnapshot
      } = summary;
      const adjustedExpectedCash = roundMoney(
        Number(summary.expected_cash || 0) + closingEntry - closingExpense,
      );
      const financialOperationId = randomUUID();
      const update = {
        status: 'fechado',
        closed_at: closedAt,
        closing_amount: closingAmount,
        closing_entry: closingEntry || null,
        closing_expense: closingExpense || null,
        difference:
          closingAmount === null
            ? null
            : roundMoney(closingAmount - adjustedExpectedCash),
        financial_operation_id: financialOperationId,
        summary: {
          ...summarySnapshot,
          closing_entry: closingEntry || 0,
          closing_expense: closingExpense || 0,
          expected_cash_before_expense: Number(summary.expected_cash || 0),
          expected_cash: adjustedExpectedCash,
        },
      };
      const financeReferences =
        closingExpense > 0 || closingEntry > 0
          ? await ensureCashFinanceReferences(sql, user)
          : {};
      const closeAudit = {
        action_type: 'caixa_fechado',
        entity_type: 'cash_session',
        entity_id: session.id,
        user_id: user.id,
        user_name: user.full_name || user.email,
        description: `Caixa fechado com ${summary.sales_count} venda(s)`,
        details: {
          ...summarySnapshot,
          closing_amount: closingAmount,
          closing_entry: closingEntry || 0,
          closing_expense: closingExpense || 0,
          difference: update.difference,
          financial_operation_id: financialOperationId,
        },
      };
      const [rowResults] = await sql.transaction((tx) => [
        tx`
          UPDATE nexo.records
          SET data=data || ${JSON.stringify(update)}::jsonb, updated_date=now()
          WHERE id=${session.id} AND market_id=${user.market_id}
            AND entity='cash_sessions' AND data->>'status'='aberto'
          RETURNING id,data,created_date,updated_date
        `,
        cashClosingExpenseQuery(
          tx,
          user,
          session,
          closingExpense,
          closedAt,
          financeReferences,
          'fechado',
          financialOperationId,
        ),
        cashClosingEntryQuery(
          tx,
          user,
          session,
          closingEntry,
          closedAt,
          financeReferences,
          'fechado',
          financialOperationId,
        ),
        tx`
          INSERT INTO nexo.records(market_id,entity,data)
          SELECT ${user.market_id},'general_audits',${JSON.stringify(closeAudit)}::jsonb
          WHERE EXISTS (
            SELECT 1 FROM nexo.records cash_session
            WHERE cash_session.id=${session.id} AND cash_session.market_id=${user.market_id}
              AND cash_session.entity='cash_sessions'
              AND cash_session.data->>'financial_operation_id'=${financialOperationId}
          )
        `,
      ]);
      const row = rowResults?.[0];
      if (!row)
        return send(res, 409, {
          message: 'O caixa já foi fechado em outra tela.',
        });
      return send(res, 200, {
        session: cashSessionForUser(user, recordFromRow(row)),
        summary: cashSummaryForUser(user, {
          ...summarySnapshot,
          sales: cashSalesDetail,
          movements: cashMovementsDetail,
          filters: { ...(cashFilters || {}), to: closedAt },
          closing_amount: closingAmount,
          closing_entry: closingEntry || 0,
          closing_expense: closingExpense || 0,
          expected_cash_before_expense: Number(summary.expected_cash || 0),
          expected_cash: adjustedExpectedCash,
          difference: update.difference,
        }),
      });
    }

    return send(res, 404, { message: 'Operação de caixa não encontrada.' });
  }
}
