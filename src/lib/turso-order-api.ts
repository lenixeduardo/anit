import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession, safeOrigin } from "@/lib/local-auth";
import { authSchema, turso } from "@/lib/turso";
import { ensureOrderSchema } from "@/lib/turso-orders";
import { shippingEnabled } from "@/lib/shipping-config";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(error:string,status:number)=>NextResponse.json({error},{status});
const validAddress=(a:unknown)=>!!a&&typeof a==="object"&&!Array.isArray(a)&&
 ["recipient","postal_code","street","number","neighborhood","city","state"].every(k=>typeof (a as Record<string,unknown>)[k]==="string"&&String((a as Record<string,unknown>)[k]).trim().length>0)&&
 /^\d{8}$/.test(String((a as Record<string,string>).postal_code))&&/^[A-Z]{2}$/.test(String((a as Record<string,string>).state));

export async function postTursoOrder(request:Request) {
 if(!safeOrigin(request)) return fail("Origem não permitida",403);
 if(shippingEnabled) return fail("Checkout Turso com frete externo ainda não habilitado",503);
 if(process.env.PAYMENT_PROVIDER!=="mercadopago") return fail("Gateway Pix ainda não habilitado",503);
 const user=await getSession(request);
 if(!user) return fail("Faça login para finalizar",401);
 const body=await request.json();
 if(!uuid.test(body?.orderId||"")||!Array.isArray(body.items)||!body.items.length||body.items.length>100||
 body.items.some((i:{id?:string;qty?:number})=>!uuid.test(i.id||"")||!Number.isInteger(i.qty)||Number(i.qty)<1||Number(i.qty)>99)) return fail("Carrinho inválido",400);
 if(body.coupon) return fail("Cupons ainda não habilitados no checkout Turso",409);
 if(!validAddress(body.shippingAddress)) return fail("Endereço obrigatório",422);
 await authSchema();await ensureOrderSchema();
 const db=turso();const tx=await db.transaction("write");
 try {
  const existing=await tx.execute({sql:"SELECT user_id,total_cents,status,shipping_address FROM orders WHERE id=?",args:[body.orderId]});
  if(existing.rows.length){
   const row=existing.rows[0];
   if(String(row.user_id)!==user.id||String(row.status)!=="pending") {await tx.rollback();return fail("Pedido já existente ou indisponível",409);}
   await tx.commit();return NextResponse.json({success:true,orderId:body.orderId,total:Number(row.total_cents)/100,status:"pending",shippingAddress:JSON.parse(String(row.shipping_address)),paymentProvider:"mercadopago"});
  }
  const ids=new Set<string>();let subtotal=0;const lines:Array<{id:string;qty:number;price:number}>=[];
  for(const item of body.items){
   if(ids.has(item.id)) throw Error("Produto duplicado");
   ids.add(item.id);
   const p=await tx.execute({sql:"SELECT price_cents,stock FROM products WHERE id=?",args:[item.id]});
   if(!p.rows.length||Number(p.rows[0].price_cents)<=0||Number(p.rows[0].stock)<item.qty) throw Error("Produto indisponível");
   const price=Number(p.rows[0].price_cents);subtotal+=price*item.qty;lines.push({id:item.id,qty:item.qty,price});
  }
  if(!Number.isSafeInteger(subtotal)||subtotal<=0) throw Error("Valor inválido");
  const shipping=subtotal>=20000?0:1890;
  const total=subtotal+shipping;
  await tx.execute({sql:"INSERT INTO orders(id,user_id,total_cents,status,shipping_address) VALUES (?,?,?,'pending',?)",args:[body.orderId,user.id,total,JSON.stringify(body.shippingAddress)]});
  for(const line of lines) await tx.execute({sql:"INSERT INTO order_items(id,order_id,product_id,quantity,price_cents) VALUES (?,?,?,?,?)",args:[randomUUID(),body.orderId,line.id,line.qty,line.price]});
  await tx.commit();
  return NextResponse.json({success:true,orderId:body.orderId,total:total/100,subtotal:subtotal/100,shipping:shipping/100,discount:0,status:"pending",shippingAddress:body.shippingAddress,paymentProvider:"mercadopago"});
 }catch(e){await tx.rollback();console.error("Turso checkout error",e);return fail("Não foi possível criar o pedido",409);}
}

export async function getTursoOrders(request:Request) {
 const user=await getSession(request);if(!user)return fail("Faça login",401);
 await authSchema();await ensureOrderSchema();
 const params=new URL(request.url).searchParams;
 const admin=params.get("scope")==="admin";
 if(admin&&user.role!=="admin")return fail("Acesso restrito",403);
 const offset=Number(params.get("offset")||0);if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)return fail("Página inválida",400);
 const id=params.get("id");if(id&&!uuid.test(id))return fail("Pedido inválido",400);
 const rows=await turso().execute({sql:"SELECT id,user_id,total_cents,status,shipping_address,created_at,paid_at FROM orders WHERE (?=1 OR user_id=?) AND (? IS NULL OR id=?) ORDER BY created_at DESC,id DESC LIMIT 100 OFFSET ?",args:[admin?1:0,user.id,id,id,offset]});
 const data=await Promise.all(rows.rows.map(async row=>{
  const items=await turso().execute({sql:"SELECT i.id,i.quantity,i.price_cents,p.name FROM order_items i LEFT JOIN products p ON p.id=i.product_id WHERE i.order_id=?",args:[String(row.id)]});
  const history=await turso().execute({sql:"SELECT previous_status,status,created_at FROM order_status_history WHERE order_id=? ORDER BY created_at",args:[String(row.id)]});
  return {id:row.id,total:Number(row.total_cents)/100,status:row.status,created_at:row.created_at,paid_at:row.paid_at,shipping_address:JSON.parse(String(row.shipping_address)),order_items:items.rows.map(i=>({id:i.id,quantity:i.quantity,price:Number(i.price_cents)/100,products:{name:i.name}})),order_status_history:history.rows};
 }));
 if(id&&!data.length)return fail("Pedido não encontrado",404);
 if(params.get("pix")==="1")return fail("Use a cobrança do provedor de pagamento",409);
 return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
}

export async function patchTursoOrder(request:Request) {
 if(!safeOrigin(request))return fail("Origem não permitida",403);
 const user=await getSession(request);if(!user)return fail("Faça login",401);
 if(user.role!=="admin")return fail("Acesso restrito",403);
 const body=await request.json();
 if(!uuid.test(body?.id||"")||!["shipped","delivered"].includes(body.status))return fail("Status inválido; pagamento é confirmado pelo provedor",400);
 return fail("Atualização de logística Turso ainda não habilitada",503);
}
