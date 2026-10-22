import "server-only";
import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { authSchema, turso } from "@/lib/turso";

const scrypt = promisify(scryptCallback);
const COOKIE = "anit_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export const emailNormalized = (email: string) => email.trim().toLowerCase();
export const cookieOptions = {
  httpOnly:true, secure:process.env.NODE_ENV==="production", sameSite:"lax" as const,
  path:"/", maxAge:SESSION_SECONDS
};

export async function hashPassword(password: string) {
 const salt=randomBytes(16).toString("hex");
 const key=await scrypt(password,salt,64) as Buffer;
 return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password:string, stored:string) {
 const [alg,salt,hex]=stored.split(":");
 if(alg!=="scrypt" || !/^[a-f0-9]{32}$/.test(salt||"") || !/^[a-f0-9]{128}$/.test(hex||"")) return false;
 const actual=await scrypt(password,salt,64) as Buffer;
 return timingSafeEqual(actual,Buffer.from(hex,"hex"));
}
export async function registerUser(name:string,email:string,password:string) {
 await authSchema();
 const id=randomUUID();
 const hash=await hashPassword(password);
 await turso().execute({sql:"INSERT INTO auth_users(id,name,email,password_hash,role) VALUES (?,?,?,?,'user')",args:[id,name,email,hash]});
 return {id,name,email,role:"user"};
}
export async function createSession(userId:string) {
 await authSchema();
 const token=randomBytes(32).toString("base64url");
 const now=Math.floor(Date.now()/1000);
 await turso().execute({sql:"INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)",args:[digest(token),userId,now+SESSION_SECONDS,now]});
 return token;
}
export async function getSession(request?:Request) {
 await authSchema();
 const cookie=request?.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)
  ?? (await cookies()).get(COOKIE)?.value;
 if(!cookie || !/^[\w-]{40,80}$/.test(cookie)) return null;
 const data=await turso().execute({sql:`SELECT u.id,u.name,u.email,u.role FROM auth_sessions s
   JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`,
   args:[digest(cookie),Math.floor(Date.now()/1000)]});
 if(!data.rows.length) return null;
 const row=data.rows[0];
 return {id:String(row.id),name:String(row.name),email:String(row.email),role:String(row.role)};
}
export async function revokeSession(request:Request) {
 const token=request.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)
  ?? (await cookies()).get(COOKIE)?.value;
 if(token && /^[\w-]{40,80}$/.test(token)) await turso().execute({sql:"DELETE FROM auth_sessions WHERE token_hash=?",args:[digest(token)]});
}
export function safeOrigin(request:Request) {
 const origin=request.headers.get("origin");
 if(!origin) return false;
 try { return new URL(origin).origin===new URL(request.url).origin; } catch {return false;}
}
export const sessionCookieName=COOKIE;
