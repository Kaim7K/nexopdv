// Only inserts missing product UUIDs in a specified market. Used by the
// offline recovery utility after its manifest/provenance checks.
export async function applyRecoveryManifest(sql, manifest) {
  const marketId = manifest.marketId;
  const [, inserted] = await sql.transaction((tx) => [
    tx`SELECT id FROM nexo.markets WHERE id=${marketId} FOR UPDATE`,
    tx`
      WITH incoming AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(manifest.rows)}::jsonb)
          AS item(id uuid,data jsonb,created_date timestamptz,updated_date timestamptz)
      ), restored AS (
        INSERT INTO nexo.records(id,market_id,entity,data,created_date,updated_date)
        SELECT incoming.id,${marketId},'products',incoming.data,incoming.created_date,now() FROM incoming
        WHERE NOT EXISTS(SELECT 1 FROM nexo.records current WHERE current.id=incoming.id)
          AND NOT EXISTS(SELECT 1 FROM nexo.records current WHERE current.market_id=${marketId} AND current.entity='products'
            AND NULLIF(btrim(incoming.data->>'barcode'),'') IS NOT NULL AND btrim(current.data->>'barcode')=btrim(incoming.data->>'barcode'))
        ON CONFLICT DO NOTHING RETURNING id
      ), audited AS (
        INSERT INTO nexo.records(market_id,entity,data)
        SELECT ${marketId},'general_audits',jsonb_build_object('action_type','produtos_recuperados_backup',
          'description','Produtos faltantes recuperados de backup, sem sobrescrever dados atuais',
          'details',jsonb_build_object('incident_id',${manifest.incidentId}::text,'snapshot_at',${manifest.snapshotAt}::text,
            'restored_ids',jsonb_agg(restored.id),'restored_count',count(*)))
        FROM restored HAVING count(*)>0 RETURNING id
      ) SELECT restored.id FROM restored JOIN audited ON true
    `,
  ]);
  return inserted;
}
