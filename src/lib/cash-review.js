// A human review remains valid only while the reviewed financial snapshot matches.
export function cashReviewFingerprint(session, summary) {
  return JSON.stringify({
    status: session.status,
    opened_at: session.opened_at,
    closed_at: session.closed_at,
    financial_operation_id: session.financial_operation_id || null,
    amounts: [session.opening_amount, session.closing_amount, session.closing_entry, session.closing_expense, summary.total, summary.sales_count, summary.entries, summary.withdrawals, summary.expected_cash].map(value => value == null ? null : Number(value)),
    payments: Object.entries(summary.payments || {}).sort(([a], [b]) => a.localeCompare(b)),
  });
}

export function cashReviewState(session, summary) {
  return {
    review_version: cashReviewFingerprint(session, summary),
    reviewed_at: session.reviewed_at || null,
    reviewed_by: session.reviewed_by || null,
    reviewed_by_name: session.reviewed_by_name || null,
    review_valid: Boolean(session.status === 'fechado' && session.reviewed_at && session.review_fingerprint === cashReviewFingerprint(session, summary)),
  };
}
