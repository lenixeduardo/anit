import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

let connection: Database.Database | undefined;
export const sqliteEnabled = process.env.DATABASE_PROVIDER === "sqlite";

export function sqlite() {
  if (!sqliteEnabled) throw new Error("SQLite backend is disabled");
  if (!connection) {
    const file = path.resolve(process.env.SQLITE_DATABASE_PATH || "./data/anit.sqlite");
    mkdirSync(path.dirname(file), { recursive: true });
    connection = new Database(file, { timeout: 5000 });
    connection.pragma("journal_mode = WAL");
    connection.pragma("foreign_keys = ON");
    connection.pragma("busy_timeout = 5000");
    connection.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS profiles (
 id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
 shipping_address TEXT, consented_at TEXT, privacy_policy_version TEXT DEFAULT '1.0',
 terms_accepted INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
 image_url TEXT, category TEXT NOT NULL, stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
 weight_kg REAL, height_cm REAL, width_cm REAL, length_cm REAL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
 total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','shipped','delivered','cancelled')),
 shipping_address TEXT, shipping_details TEXT, tracking_code TEXT,
 paid_at TEXT, shipped_at TEXT, delivered_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
 quantity INTEGER NOT NULL CHECK(quantity > 0), price_cents INTEGER NOT NULL CHECK(price_cents >= 0)
);
CREATE TABLE IF NOT EXISTS order_status_history (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 previous_status TEXT NOT NULL, status TEXT NOT NULL, changed_by TEXT REFERENCES profiles(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 action TEXT NOT NULL, table_name TEXT, record_id TEXT, ip_address TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS shipping_quotes (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 items TEXT NOT NULL, postal_code TEXT NOT NULL, service_id TEXT NOT NULL,
 service_name TEXT NOT NULL, price_cents INTEGER NOT NULL,
 delivery_days INTEGER NOT NULL, expires_at TEXT NOT NULL, sandbox INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE TRIGGER IF NOT EXISTS orders_address_immutable BEFORE UPDATE OF shipping_address ON orders
WHEN OLD.shipping_address IS NOT NEW.shipping_address
BEGIN SELECT RAISE(ABORT,'ORDER_SHIPPING_ADDRESS_IMMUTABLE'); END;
`);
  }
  return connection;
}

export function publicProduct(row: Record<string, unknown>) {
  const { price_cents, ...rest } = row;
  return { ...rest, price: Number(price_cents) / 100 };
}
