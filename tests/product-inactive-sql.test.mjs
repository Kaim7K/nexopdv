import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { inactiveProducts, handleInactiveCleanup } from "../server/product-inactive.js";


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

await db.query("DELETE FROM nexo.records");
const makeId=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function productRow(n,age,data={},marketId=market){
 await db.query("INSERT INTO nexo.records(id,market_id,entity,data,created_date) VALUES($1,$2,'products',$3,now()-($4::text)::interval)",[makeId(n),marketId,JSON.stringify({name:'Item '+n,quantity:10,...data}),age]);
}
await productRow(1,'4 months');
await productRow(2,'2 months');
await productRow(3,'5 months',{last_sale_at:new Date().toISOString()});
await productRow(4,'5 months');
await productRow(5,'5 months',{},otherMarket);
await productRow(6,'3 months');
await db.query("INSERT INTO nexo.records(market_id,entity,data) VALUES($1,'sales',$2)",[market,JSON.stringify({status:'concluida',items:[{product_id:makeId(4)}]})]);
let eligible=await inactiveProducts(sql,market);
assert.deepEqual(eligible.map(p=>p.id),[makeId(1),makeId(6)]);
const res={status(n){this.code=n;return this;},json(body){this.body=body;return this;},setHeader(){},getHeader(){},end(body){this.body=JSON.parse(body);}};
async function remove(products,who=user){await handleInactiveCleanup({req:{method:'POST',body:{confirmation:'LIXEIRA_SEM_VENDA_3_MESES',products}},res,sql,user:who});}
await remove(eligible,{...user,role:'vendedor'}); assert.equal(res.code,403);
await db.query("UPDATE nexo.records SET updated_date=now()+interval '1 second' WHERE id=$1",[makeId(1)]);
await remove(eligible);assert.equal(res.code,409);
assert.equal((await db.query("SELECT count(*)::int AS n FROM nexo.records WHERE entity='product_trash'")).rows[0].n,0);
eligible=await inactiveProducts(sql,market);
await remove(eligible);assert.equal(res.code,200);assert.equal(res.body.deleted,2);
const trash=(await db.query("SELECT data FROM nexo.records WHERE id=$1",[makeId(1)])).rows[0];
assert.equal(trash.data.product.quantity,10);
assert.equal((await db.query("SELECT entity FROM nexo.records WHERE id=$1",[makeId(5)])).rows[0].entity,'products');
console.log('PASS: 3 months, recent sales/cache, tenant isolation, permissions, stale batch and recoverable snapshots');
await db.close();
