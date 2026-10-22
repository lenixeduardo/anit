import { NextResponse } from "next/server";
import { authSchema, turso } from "@/lib/turso";
import { createSession, cookieOptions, emailNormalized, getSession, hashPassword, registerUser, revokeSession, safeOrigin, sessionCookieName, verifyPassword } from "@/lib/local-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
const validEmail=(s:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)&&s.length<=254;
export async function GET(request:Request){
 try{
  const user=await getSession(request);
  return NextResponse.json({user},{headers:{"Cache-Control":"no-store"}});
 }catch{return fail("Autenticação indisponível",503);}
}
export async function POST(request:Request){
 if(!safeOrigin(request)) return fail("Origem não permitida",403);
 try{
  const body=await request.json();
  const action=body?.action;
  const email=typeof body.email==="string"?emailNormalized(body.email):"";
  const password=typeof body.password==="string"?body.password:"";
  if(action==="logout"){
   await revokeSession(request);
   const response=NextResponse.json({success:true});
   response.cookies.set(sessionCookieName,"",{...cookieOptions,maxAge:0});
   return response;
  }
  if(!validEmail(email)||password.length<12||password.length>128) return fail("Credenciais inválidas (senha mínima: 12 caracteres)",400);
  await authSchema();
  let user:{id:string;name:string;email:string;role:string};
  if(action==="register"){
   const name=typeof body.name==="string"?body.name.trim():"";
   if(name.length<2||name.length>100||body.termsAccepted!==true) return fail("Nome e consentimento são obrigatórios",400);
   try{ user=await registerUser(name,email,password); }
   catch(e){if(String(e).includes("UNIQUE")) return fail("Não foi possível concluir o cadastro",409);throw e;}
  }else if(action==="login"){
   const db=turso(),now=Math.floor(Date.now()/1000);
   const attempts=await db.execute({sql:"SELECT COUNT(*) total FROM auth_login_attempts WHERE email=? AND attempted_at>?",args:[email,now-900]});
   if(Number(attempts.rows[0].total)>=8) return fail("Muitas tentativas. Tente mais tarde",429);
   const rows=await db.execute({sql:"SELECT id,name,email,role,password_hash FROM auth_users WHERE email=?",args:[email]});
   const record=rows.rows[0];
   // Run the password KDF even for unknown accounts to limit timing differences.
   const fallback=await hashPassword("invalid-fallback-password");
   const valid=await verifyPassword(password,String(record?.password_hash??fallback));
   if(!record||!valid){
    await db.execute({sql:"INSERT INTO auth_login_attempts(email,attempted_at) VALUES (?,?)",args:[email,now]});
    return fail("Email ou senha inválidos",401);
   }
   await db.execute({sql:"DELETE FROM auth_login_attempts WHERE email=?",args:[email]});
   user={id:String(record.id),name:String(record.name),email:String(record.email),role:String(record.role)};
  }else return fail("Operação inválida",400);
  const token=await createSession(user.id);
  const response=NextResponse.json({success:true,user},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set(sessionCookieName,token,cookieOptions);
  return response;
 }catch(e){console.error("Local auth failure",e);return fail("Serviço de autenticação indisponível",503);}
}
