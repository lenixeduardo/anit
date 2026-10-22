import "server-only";
import { turso } from "@/lib/turso";
import { randomUUID } from "node:crypto";

export async function ensureOrderSchema() {
  const db = turso();
  const statements = [
    `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents >= 0), stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0))`,
    `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id), total_cents INTEGER NOT NULL CHECK(total_cents > 0), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','shipped','delivered','cancelled')), shipping_address TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, paid_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity > 0), price_cents INTEGER NOT NULL CHECK(price_cents >= 0))`,
    `CREATE TABLE IF NOT EXISTS payment_transactions (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), provider TEXT NOT NULL, provider_payment_id TEXT NOT NULL UNIQUE, amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), status TEXT NOT NULL, UNIQUE(order_id, provider))`,
    `CREATE TABLE IF NOT EXISTS order_status_history (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), previous_status TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,created_at)`
  ];
  for (const sql of statements) await db.execute(sql);
}

export async function findUserOrder(userId: string, orderId: string) {
  const result = await turso().execute({sql:"SELECT id,user_id,total_cents,status,shipping_address FROM orders WHERE id=? AND user_id=? LIMIT 1",args:[orderId,userId]});
  return result.rows[0] ?? null;
}

export async function findPayment(orderId: string) {
  const result = await turso().execute({sql:"SELECT provider_payment_id,amount_cents,status FROM payment_transactions WHERE order_id=? AND provider='mercadopago' LIMIT 1",args:[orderId]});
  return result.rows[0] ?? null;
}

export async function recordPayment(orderId: string, providerPaymentId: string, amountCents: number) {
  if (!/^\d{1,32}$/.test(providerPaymentId) || !Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("Invalid payment");
  await turso().execute({sql:"INSERT INTO payment_transactions(id,order_id,provider,provider_payment_id,amount_cents,status) VALUES (?,?, 'mercadopago',?,?,'pending') ON CONFLICT(order_id,provider) DO NOTHING",args:[randomUUID(),orderId,providerPaymentId,amountCents]});
  const current=await findPayment(orderId);
  if (String(current?.provider_payment_id)!==providerPaymentId || Number(current?.amount_cents)!==amountCents) throw new Error("Payment reconciliation conflict");
}

export async function reconcilePayment(paymentId:string, orderId:string, amountCents:number, status:"approved"|"cancelled"|"rejected") {
  const db=turso();
  const tx=await db.transaction("write");
  try {
    const payment=await tx.execute({sql:"SELECT order_id,amount_cents,status FROM payment_transactions WHERE provider_payment_id=? AND provider='mercadopago'",args:[paymentId]});
    if (!payment.rows.length || String(payment.rows[0].order_id)!==orderId || Number(payment.rows[0].amount_cents)!==amountCents) throw new Error("Payment mismatch");
    const order=await tx.execute({sql:"SELECT status,total_cents FROM orders WHERE id=?",args:[orderId]});
    if (!order.rows.length || Number(order.rows[0].total_cents)!==amountCents) throw new Error("Order mismatch");
    const current=String(order.rows[0].status);
    if (status==="approved" && current==="pending") {
      const lines=await tx.execute({sql:"SELECT product_id,quantity FROM order_items WHERE order_id=?",args:[orderId]});
      if (!lines.rows.length) throw new Error("Empty order");
      for (const line of lines.rows) {
        const update=await tx.execute({sql:"UPDATE products SET stock=stock-? WHERE id=? AND stock>=?",args:[Number(line.quantity),String(line.product_id),Number(line.quantity)]});
        if (update.rowsAffected!==1) throw new Error("Insufficient stock");
      }
      await tx.execute({sql:"UPDATE orders SET status='paid',paid_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",args:[orderId]});
      await tx.execute({sql:"INSERT INTO order_status_history(id,order_id,previous_status,status) VALUES (?,?,'pending','paid')",args:[randomUUID(),orderId]});
    } else if ((status==="cancelled"||status==="rejected") && current==="pending") {
      await tx.execute({sql:"UPDATE orders SET status='cancelled' WHERE id=? AND status='pending'",args:[orderId]});
      await tx.execute({sql:"INSERT INTO order_status_history(id,order_id,previous_status,status) VALUES (?,?,'pending','cancelled')",args:[randomUUID(),orderId]});
    } else if (status==="approved" && current!=="paid" && current!=="shipped" && current!=="delivered") throw new Error("Unexpected order state");
    // A delayed rejection must never overwrite an already confirmed payment.
    if ((current==="paid"||current==="shipped"||current==="delivered") && status!=="approved") {
      await tx.commit();
      return;
    }
    await tx.execute({sql:"UPDATE payment_transactions SET status=? WHERE provider_payment_id=?",args:[status,paymentId]});
    await tx.commit();
  } catch (error) {await tx.rollback();throw error;}
}
