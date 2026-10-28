import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { archiveProduct, handleProductTrash } from "../server/product-trash.js";
import { applyRecoveryManifest } from '../server/product-backup-restore.js';

// Isolated actual PostgreSQL (WASM); never reads production credentials/data.
// npm install --prefix artifacts/recovery-sql --no-save --package-lock=false --ignore-scripts @electric-sql/pglite
const { PGlite } = await import(
  pathToFileURL(
    path.resolve(
      "artifacts/recovery-sql/node_modules/@electric-sql/pglite/dist/index.js",
    ),
  ).href
);
const db = new PGlite();
await db.exec(`CREATE SCHEMA nexo;
  CREATE TABLE nexo.markets(id uuid PRIMARY KEY, product_limit integer);
  CREATE TABLE nexo.records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), market_id uuid NOT NULL,
    entity text NOT NULL,data jsonb NOT NULL,created_date timestamptz NOT NULL DEFAULT now(),updated_date timestamptz NOT NULL DEFAULT now());`);
const market = "10000000-0000-4000-8000-000000000001";
const otherMarket = "10000000-0000-4000-8000-000000000002";
const id = "20000000-0000-4000-8000-000000000001";
const user = {
  id: "30000000-0000-4000-8000-000000000001",
  market_id: market,
  role: "admin",
  full_name: "Teste local",
  enabled_modules: ["estoque"],
};
const product = {
  name: "Produto de teste",
  barcode: "7891234567890",
  quantity: 7.5,
  cost_price: 2.1,
  sale_price: 4.99,
  status: "ativo",
  image_url: "data:image/png;base64,dGVzdA==",
  extra: { preserved: true },
};
await db.query("INSERT INTO nexo.markets VALUES ($1,NULL),($2,NULL)", [
  market,
  otherMarket,
]);
await db.query(
  "INSERT INTO nexo.records(id,market_id,entity,data,created_date) VALUES($1,$2,'products',$3,'2025-01-01')",
  [id, market, JSON.stringify(product)],
);
const sql = (strings, ...values) =>
  db
    .query(
      strings.reduce(
        (result, part, index) => result + (index ? `$${index}` : "") + part,
        "",
      ),
      values,
    )
    .then((result) => result.rows);
sql.transaction = async (callback) => {
  await db.exec("BEGIN");
  try {
    const result = await Promise.all(callback(sql));
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
};
const response = () => ({
  statusCode: 0,
  data: null,
  getHeader() {},
  setHeader() {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.data = data;
    return this;
  },
});
const restore = async (actor = user) => {
  const res = response();
  await handleProductTrash({
    req: { method: "POST", query: {} },
    res,
    sql,
    user: actor,
    path: ["products", "trash", id, "restore"],
  });
  return res;
};
try {
  // An audit failure must roll back the archive, rather than lose the snapshot.
  await db.exec(
    "CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity='general_audits' THEN RAISE EXCEPTION 'simulated audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_audit BEFORE INSERT ON nexo.records FOR EACH ROW EXECUTE FUNCTION reject_audit();",
  );
  await assert.rejects(
    archiveProduct(sql, user, id),
    /simulated audit failure/,
  );
  assert.equal(
    (await db.query("SELECT entity FROM nexo.records WHERE id=$1", [id]))
      .rows[0].entity,
    "products",
  );
  await db.exec("DROP TRIGGER fail_audit ON nexo.records");
  assert.equal((await archiveProduct(sql, user, id)).id, id);
  let stored = (await db.query("SELECT * FROM nexo.records WHERE id=$1", [id]))
    .rows[0];
  assert.equal(stored.entity, "product_trash");
  assert.deepEqual(stored.data.product, product);
  assert.equal(
    (await restore({ ...user, market_id: otherMarket })).statusCode,
    409,
  );
  assert.equal((await restore({ ...user, role: "vendedor" })).statusCode, 403);
  await db.query(
    "INSERT INTO nexo.records(market_id,entity,data) VALUES($1,'products',$2)",
    [market, JSON.stringify({ ...product, name: "Cadastro posterior" })],
  );
  assert.equal(
    (await restore()).statusCode,
    409,
    "Must not overwrite a later product with the same barcode",
  );
  await db.query(
    "DELETE FROM nexo.records WHERE market_id=$1 AND entity='products'",
    [market],
  ); // disposable fixture only
  assert.equal((await restore()).statusCode, 200);
  stored = (await db.query("SELECT * FROM nexo.records WHERE id=$1", [id]))
    .rows[0];
  const { _restored_from_trash, ...restoredData } = stored.data;
  assert.deepEqual(restoredData, product);
  assert.equal(stored.entity, "products");
  assert.equal(
    new Date(stored.created_date).toISOString(),
    "2025-01-01T00:00:00.000Z",
  );
  assert.equal((await restore()).data.already_restored, true);
  assert.equal(
    Number(
      (
        await db.query(
          "SELECT count(*) FROM nexo.records WHERE entity='general_audits'",
        )
      ).rows[0].count,
    ),
    2,
  );
  const missingId = '20000000-0000-4000-8000-000000000002';
  const foreignId = '20000000-0000-4000-8000-000000000003';
  await db.query("INSERT INTO nexo.records(id,market_id,entity,data) VALUES($1,$2,'products',$3)", [foreignId, otherMarket, JSON.stringify({ name: 'Outro mercado', quantity: 90 })]);
  const manifest = { marketId: market, incidentId: '40000000-0000-4000-8000-000000000001', snapshotAt: '2026-10-28T12:00:00.000Z', rows: [
    { id, data: { ...product, quantity: 999 }, created_date: '2025-01-01' },
    { id: missingId, data: { name: 'Cadastro recuperado de backup', barcode: '7890000000001', quantity: 12, cost_price: 3.77, sale_price: 7.49 }, created_date: '2025-02-01' },
    { id: foreignId, data: { name: 'Não substituir outro mercado', quantity: 999 }, created_date: '2025-01-01' },
  ] };
  const inserted = await applyRecoveryManifest(sql, manifest);
  assert.deepEqual(inserted.map((row) => row.id), [missingId]);
  assert.equal((await db.query('SELECT data FROM nexo.records WHERE id=$1', [id])).rows[0].data.quantity, 7.5);
  assert.equal((await db.query('SELECT data FROM nexo.records WHERE id=$1', [foreignId])).rows[0].data.quantity, 90);
  assert.deepEqual((await db.query('SELECT data FROM nexo.records WHERE id=$1', [missingId])).rows[0].data, manifest.rows[1].data);
  assert.equal((await applyRecoveryManifest(sql, manifest)).length, 0);
  console.log(
    "Product recovery SQL passed: full payload, audit rollback, tenant/role isolation, conflict protection, original dates and idempotent restore.",
  );
} finally {
  await db.close();
}
