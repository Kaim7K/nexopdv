import { applyRecoveryManifest } from '../server/product-backup-restore.js';
import { neon } from "@neondatabase/serverless";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

// No full database rewind. Inspect/plan are read-only; apply inserts only missing
// products for the explicitly selected market. Never logs connection strings.
const args = process.argv.slice(2);
const mode = args[0];
const option = (name) => args[args.indexOf(name) + 1];
const uuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value || "",
  );
const normalize = (text) =>
  String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const requireEnv = (name) => {
  if (!process.env[name])
    throw new Error(
      `${name} não configurada. Configure a conexão de forma privada; não publique credenciais.`,
    );
  return process.env[name];
};

async function main() {
  if (!["inspect", "plan", "apply"].includes(mode))
    throw new Error(
      'Uso: inspect --market "nome" | plan --market-id UUID --incident-id UUID --snapshot-at ISO | apply --manifest arquivo --market-id UUID',
    );
  const target = neon(requireEnv("RECOVERY_TARGET_DATABASE_URL"));
  if (mode === "inspect") {
    if (!args.includes("--market") || !option("--market"))
      throw new Error("Informe --market.");
    const requested = normalize(option("--market"));
    const rows =
      await target`SELECT id,name FROM nexo.markets WHERE lower(name) LIKE ${`%${requested.split(" ")[0]}%`} LIMIT 50`;
    const markets = rows.filter((row) =>
      normalize(row.name).includes(requested),
    );
    if (markets.length !== 1)
      throw new Error(
        "Nome não identifica um único mercado. Nenhuma alteração realizada.",
      );
    const incidents =
      await target`SELECT id,created_date,data->'details'->'deleted' AS deleted FROM nexo.records WHERE market_id=${markets[0].id} AND entity='general_audits' AND data->>'action_type'='produtos_inativos_excluidos' ORDER BY created_date DESC LIMIT 10`;
    console.log(JSON.stringify({ market: markets[0], incidents }, null, 2));
    return;
  }
  const marketId = option("--market-id");
  if (!args.includes("--market-id") || !uuid(marketId))
    throw new Error("Informe o UUID explícito do mercado com --market-id.");
  if (mode === "plan") {
    const incidentId = option("--incident-id");
    const snapshotAt = option("--snapshot-at");
    if (
      !uuid(incidentId) ||
      !snapshotAt ||
      !Number.isFinite(Date.parse(snapshotAt))
    )
      throw new Error("Informe --incident-id e --snapshot-at válidos.");
    const [incident] =
      await target`SELECT id,created_date,(data->'details'->>'deleted')::int AS deleted FROM nexo.records WHERE market_id=${marketId} AND id=${incidentId} AND entity='general_audits' AND data->>'action_type'='produtos_inativos_excluidos'`;
    if (!incident || !(incident.deleted > 0))
      throw new Error("Incidente não confirmado para este mercado.");
    const gap = Date.parse(incident.created_date) - Date.parse(snapshotAt);
    if (gap <= 0 || gap > 60_000)
      throw new Error(
        "Use uma branch de backup imediatamente anterior ao incidente (até 60 segundos), com os dados confirmados antes da exclusão.",
      );
    const source = neon(requireEnv("RECOVERY_SOURCE_DATABASE_URL"));
    const [boundary] =
      await target`SELECT (${incident.created_date}::timestamptz - interval '2 months') AS cutoff`;
    const sourceRows =
      await source`SELECT id,data,created_date,updated_date FROM nexo.records WHERE market_id=${marketId} AND entity='products' ORDER BY id`;
    const candidates = sourceRows.filter((row) => {
      const reference = /^\d{4}-\d{2}-\d{2}T/.test(row.data.last_sale_at || "")
        ? row.data.last_sale_at
        : row.created_date;
      if (!Number.isFinite(Date.parse(reference)))
        throw new Error("Data inválida no backup; revisão manual necessária.");
      return Date.parse(reference) < Date.parse(boundary.cutoff);
    });
    if (candidates.length !== incident.deleted)
      throw new Error(
        `Backup não corresponde ao lote: ${candidates.length} candidatos, auditoria registra ${incident.deleted}. Nenhuma restauração automática permitida.`,
      );
    if (
      candidates.some(
        (row) => Date.parse(row.updated_date) > Date.parse(snapshotAt),
      )
    )
      throw new Error(
        "A origem não corresponde ao ponto de recuperação informado.",
      );
    const existing =
      await target`SELECT id,data->>'barcode' AS barcode FROM nexo.records WHERE market_id=${marketId} AND entity IN ('products','product_trash')`;
    const currentIds = new Set(existing.map((row) => row.id));
    const missing = candidates.filter((row) => !currentIds.has(row.id));
    const duplicate = missing.some(
      (row) =>
        row.data.barcode &&
        existing.some(
          (item) => item.barcode?.trim() === String(row.data.barcode).trim(),
        ),
    );
    if (duplicate)
      throw new Error(
        "Há código de barras já recadastrado. Revisão manual necessária; nenhum produto será sobrescrito.",
      );
    const manifest = {
      marketId,
      incidentId,
      snapshotAt,
      expectedDeleted: incident.deleted,
      rows: missing,
    };
    await mkdir("artifacts/recovery", { recursive: true });
    const file = `artifacts/recovery/${incidentId}.json`;
    await writeFile(
      file,
      JSON.stringify({ ...manifest, digest: hash(manifest) }, null, 2),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        file,
        missing: missing.length,
        alreadyPresent: candidates.length - missing.length,
        productionChanged: false,
      }),
    );
    return;
  }
  if (!args.includes("--manifest"))
    throw new Error("Informe o manifesto revisado.");
  const { digest, ...manifest } = JSON.parse(
    await readFile(option("--manifest"), "utf8"),
  );
  if (
    hash(manifest) !== digest ||
    manifest.marketId !== marketId ||
    !uuid(manifest.incidentId) ||
    !Array.isArray(manifest.rows) ||
    manifest.rows.length > manifest.expectedDeleted
  )
    throw new Error("Manifesto inválido ou mercado divergente.");
  const [incident] =
    await target`SELECT id FROM nexo.records WHERE id=${manifest.incidentId} AND market_id=${marketId} AND entity='general_audits' AND data->>'action_type'='produtos_inativos_excluidos' AND (data->'details'->>'deleted')::int=${manifest.expectedDeleted}`;
  if (!incident)
    throw new Error("Incidente não confirmado no banco de destino.");
  const inserted = await applyRecoveryManifest(target, manifest);
  console.log(
    JSON.stringify({
      restored: inserted.length,
      skippedWithoutOverwrite: manifest.rows.length - inserted.length,
      marketId,
      incidentId: manifest.incidentId,
    }),
  );
}
main().catch((error) => {
  // Provider errors can contain connection details. Print only our own messages.
  console.error(
    error.constructor === Error
      ? error.message
      : "Falha na conexão ou na transação. Nenhum dado atual foi sobrescrito. Consulte o responsável pelo banco.",
  );
  process.exitCode = 1;
});
