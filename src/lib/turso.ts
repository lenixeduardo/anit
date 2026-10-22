import "server-only";
import { createClient, type Client } from "@libsql/client";

let client: Client | undefined;
export function turso(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) throw new Error("Missing Turso server configuration");
    client = createClient({ url, authToken });
  }
  return client;
}
let initialization: Promise<void> | undefined;
export function authSchema() {
  if (!initialization) {
    initialization = (async () => {
      const db = turso();
      await db.execute(`CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL, password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
      )`);
      await db.execute("CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id)");
      await db.execute("CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at)");
      await db.execute(`CREATE TABLE IF NOT EXISTS auth_login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL,
        attempted_at INTEGER NOT NULL
      )`);
      await db.execute("CREATE INDEX IF NOT EXISTS auth_attempts_email_time ON auth_login_attempts(email,attempted_at)");
    })().catch(error => { initialization=undefined; throw error; });
  }
  return initialization;
}
