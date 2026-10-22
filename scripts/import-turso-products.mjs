import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const file = process.argv[2];
if (!file || !process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("Usage: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/import-turso-products.mjs products.json");
  process.exit(1);
}
const rows = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(rows) || !rows.length) throw new Error("Expected non-empty product JSON array");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const db = createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
const seen = new Set();
const records = rows.map(p => {
  const id = String(p.id || "");
  const name = String(p.name || "").trim();
  const cents = p.price_cents == null ? Math.round(Number(p.price) * 100) : Number(p.price_cents);
  const stock = Number(p.stock);
  if (!uuid.test(id) || seen.has(id) || !name || !Number.isSafeInteger(cents) || cents <= 0 || !Number.isSafeInteger(stock) || stock < 0) throw new Error("Invalid/duplicate product: " + id);
  seen.add(id);
  return {id,name,cents,stock,description:p.description||null,category:p.category||null,image:p.image_url||null};
});
const tx = await db.transaction("write");
try {
  await tx.execute("CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, category TEXT, image_url TEXT, price_cents INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0)");
  const info = await tx.execute("PRAGMA table_info(products)");
  const existing = new Set(info.rows.map(row=>String(row.name)));
  for (const column of ["description","category","image_url"]) if (!existing.has(column)) await tx.execute("ALTER TABLE products ADD COLUMN " + column + " TEXT");
  for (const p of records) {
    // Never overwrite stock or price for an existing product with active orders.
    await tx.execute({sql:"INSERT INTO products(id,name,description,category,image_url,price_cents,stock) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",args:[p.id,p.name,p.description,p.category,p.image,p.cents,p.stock]});
  }
  await tx.commit();
} catch(e) {await tx.rollback();throw e;}
const result = await db.execute("SELECT COUNT(*) AS total FROM products");
console.log(JSON.stringify({imported_candidates:records.length,total_products:Number(result.rows[0].total)}));
db.close();
