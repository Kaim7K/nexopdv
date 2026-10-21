import { send } from '../http.js';
import { cashReviewFingerprint, cashReviewState } from '../../src/lib/cash-review.js';

export async function reviewCashSession({ req, res, sql, user, path }, { recordFromRow, getCashSessionSummary }) {
  if (!['POST', 'DELETE'].includes(req.method)) return send(res, 405, { message: 'Método não permitido.' });
  const removing = req.method === 'DELETE';
  if (!['admin', 'gerente'].includes(user.role)) return send(res, 403, { message: 'Apenas gerentes e administradores podem verificar caixas.' });
  const [row] = await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE id=${path[1]} AND market_id=${user.market_id} AND entity='cash_sessions'`;
  if (!row) return send(res, 404, { message: 'Caixa não encontrado.' });
  const session = recordFromRow(row);
  if (session.status !== 'fechado') return send(res, 409, { message: 'Feche o caixa antes de marcá-lo como verificado.' });
  const summary = await getCashSessionSummary(sql, user.market_id, session);
  const state = cashReviewState(session, summary);
  if (removing ? !session.reviewed_at : state.review_valid) return send(res, 200, state);
  if (removing && req.body?.reviewed_at !== session.reviewed_at)
    return send(res, 409, { message: 'A verificação mudou. Atualize o histórico antes de desmarcar.' });
  const fingerprint = cashReviewFingerprint(session, summary);
  if (!removing && req.body?.version !== fingerprint)
    return send(res, 409, { message: 'Os dados mudaram desde a consulta. Atualize o histórico e confira novamente.' });
  const review = removing
    ? { reviewed_at: null, reviewed_by: null, reviewed_by_name: null, review_fingerprint: null }
    : { reviewed_at: new Date().toISOString(), reviewed_by: user.id, reviewed_by_name: user.full_name || user.email, review_fingerprint: fingerprint };
  const audit = { action_type: removing ? 'caixa_verificacao_removida' : 'caixa_verificado', entity_type: 'cash_session', entity_id: session.id, user_id: user.id, user_name: user.full_name || user.email, description: removing ? 'Verificação do caixa desmarcada' : 'Conferência gerencial do caixa', details: removing ? { previous_reviewed_at: session.reviewed_at, previous_reviewed_by: session.reviewed_by } : { reviewed_at: review.reviewed_at, fingerprint } };
  // The review and its audit are one atomic operation; a concurrent edit cannot
  // silently receive a verification of an older financial snapshot.
  const [updated] = await sql`
    WITH reviewed AS (
      UPDATE nexo.records SET data=data || ${JSON.stringify(review)}::jsonb,updated_date=now()
      WHERE id=${session.id} AND market_id=${user.market_id} AND entity='cash_sessions'
        AND data->>'status'='fechado' AND updated_date=${row.updated_date}::timestamptz
        AND (${removing} OR data->>'review_fingerprint' IS DISTINCT FROM ${fingerprint})
      RETURNING id,data,created_date,updated_date
    ), audit AS (
      INSERT INTO nexo.records(market_id,entity,data)
      SELECT ${user.market_id},'general_audits',${JSON.stringify(audit)}::jsonb FROM reviewed RETURNING id
    ) SELECT id,data,created_date,updated_date FROM reviewed
  `;
  if (updated) return send(res, 200, cashReviewState(recordFromRow(updated), summary));
  const [latest] = await sql`SELECT id,data,created_date,updated_date FROM nexo.records WHERE id=${session.id} AND market_id=${user.market_id} AND entity='cash_sessions'`;
  if (latest) {
    const latestSession = recordFromRow(latest);
    const latestSummary = await getCashSessionSummary(sql, user.market_id, latestSession);
    const state = cashReviewState(latestSession, latestSummary);
    if (removing ? !state.reviewed_at : state.review_valid) return send(res, 200, state);
  }
  return send(res, 409, { message: 'O caixa foi alterado. Atualize o histórico e confira novamente.' });
}
