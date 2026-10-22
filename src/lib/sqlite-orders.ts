import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import { createPixPayload, PIX_KEY } from "@/lib/pix";
import { sqlite } from "@/lib/sqlite";

type Row = Record<string, any>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class CheckoutError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
const json = (value: string | null) => value ? JSON.parse(value) : null;

async function actor(request: Request) {
 const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
 if (!token) return null;
 const {data:{user},error} = await supabase.auth.getUser(token);
 if (error || !user?.email) return null;
 const db = sqlite();
 db.prepare("INSERT OR IGNORE INTO users(id,email) VALUES (?,?)").run(user.id,user.email);
 db.prepare("INSERT OR IGNORE INTO profiles(id,name,email,role) VALUES (?,?,?,'user')").run(user.id, String(user.user_metadata?.full_name || user.user_metadata?.name || "Cliente ANIT"),user.email);
 const profile = db.prepare("SELECT * FROM profiles WHERE id=?").get(user.id) as Row;
 return {user, profile, admin:profile.role==="admin"};
}
function validAddress(a: unknown): a is Record<string,string> {
 if (!a || typeof a!=="object" || Array.isArray(a)) return false;
 const v=a as Record<string,unknown>;
 return ["recipient","postal_code","street","number","neighborhood","city","state"].every(k=>typeof v[k]==="string" && String(v[k]).trim().length>0 && String(v[k]).length<=200)
 && /^\d{8}$/.test(String(v.postal_code)) && v.postal_code!=="00000000" && /^[A-Z]{2}$/.test(String(v.state));
}
function orderDetail(db: ReturnType<typeof sqlite>, row: Row) {
 const items=(db.prepare("SELECT i.id,i.quantity,i.price_cents,p.name FROM order_items i LEFT JOIN products p ON p.id=i.product_id WHERE i.order_id=?").all(row.id) as Row[])
  .map(i=>({id:i.id,quantity:i.quantity,price:i.price_cents/100,products:i.name?{name:i.name}:null}));
 const history=db.prepare("SELECT previous_status,status,created_at FROM order_status_history WHERE order_id=? ORDER BY created_at").all(row.id);
 const profile=row.user_id?db.prepare("SELECT name,email FROM profiles WHERE id=?").get(row.user_id):null;
 return {id:row.id,total:row.total_cents/100,status:row.status,created_at:row.created_at,
   shipping_details:json(row.shipping_details),shipping_address:json(row.shipping_address),
   tracking_code:row.tracking_code,paid_at:row.paid_at,shipped_at:row.shipped_at,delivered_at:row.delivered_at,
   profiles:profile,order_items:items,order_status_history:history};
}
export async function sqlitePostOrder(request: Request) {
 try {
  const a=await actor(request);
  if(!a) return NextResponse.json({error:"Faça login para finalizar"},{status:401});
  const body=await request.json();
  if(!uuid.test(body.orderId||"")||!Array.isArray(body.items)||!body.items.length||body.items.length>100||
    body.items.some((i:Row)=>!uuid.test(i.id||"")||!Number.isInteger(i.qty)||i.qty<1||i.qty>99))
    return NextResponse.json({error:"Carrinho inválido"},{status:400});
  if(!["","PRINCESS10"].includes(body.coupon||"")) return NextResponse.json({error:"Cupom inválido"},{status:400});
  const db=sqlite();
  const result=db.transaction(()=>{
   const existing=db.prepare("SELECT * FROM orders WHERE id=?").get(body.orderId) as Row|undefined;
   if(existing){
    if(existing.user_id!==a.user.id || existing.status!=="pending") throw new CheckoutError("Pedido já existe ou não pertence a esta conta",409);
    if(!validAddress(json(existing.shipping_address))) throw new CheckoutError("ADDRESS_REQUIRED",422);
    return {orderId:existing.id,total:existing.total_cents/100,status:existing.status,shippingAddress:json(existing.shipping_address)};
   }
   const profile=db.prepare("SELECT shipping_address FROM profiles WHERE id=?").get(a.user.id) as Row;
   const address=json(profile.shipping_address);
   if(!validAddress(address)) throw new CheckoutError("ADDRESS_REQUIRED",422);
   const ids=new Set<string>(); let subtotal=0;
   const lines: Array<{id:string;qty:number;price:number}>=[];
   for(const item of body.items){
    if(ids.has(item.id)) throw new CheckoutError("Produto repetido");
    ids.add(item.id);
    const product=db.prepare("SELECT * FROM products WHERE id=?").get(item.id) as Row|undefined;
    if(!product||product.stock<item.qty||product.price_cents<=0) throw new CheckoutError("Produto indisponível ou estoque insuficiente");
    subtotal+=product.price_cents*item.qty;
    lines.push({id:item.id,qty:item.qty,price:product.price_cents});
   }
   const discount=body.coupon==="PRINCESS10"?Math.round(subtotal*0.1):0;
   const shipping=subtotal>=20000?0:1890;
   const total=subtotal-discount+shipping;
   db.prepare("INSERT INTO orders(id,user_id,total_cents,status,shipping_address) VALUES (?,?,?,'pending',?)")
    .run(body.orderId,a.user.id,total,JSON.stringify(address));
   const insert=db.prepare("INSERT INTO order_items(id,order_id,product_id,quantity,price_cents) VALUES (?,?,?,?,?)");
   for(const line of lines) insert.run(randomUUID(),body.orderId,line.id,line.qty,line.price);
   return {orderId:body.orderId,total:total/100,subtotal:subtotal/100,discount:discount/100,shipping:shipping/100,status:"pending",shippingAddress:address};
  }).immediate();
  if(process.env.PAYMENT_PROVIDER==="mercadopago")
   return NextResponse.json({success:true,...result,paymentProvider:"mercadopago"});
  const payload=createPixPayload(Math.round(result.total*100),result.orderId.replace(/-/g,"").slice(0,25));
  return NextResponse.json({success:true,...result,payload,qr:await QRCode.toDataURL(payload,{width:512,margin:4}),key:PIX_KEY,receiver:"ANIT HEADSHOP",city:"SAO PAULO"});
 } catch(e) {
  if(e instanceof CheckoutError) return NextResponse.json({error:e.message,code:e.message==="ADDRESS_REQUIRED"?"ADDRESS_REQUIRED":"ORDER_FAILED"},{status:e.status});
  console.error("SQLite create order failure",e);
  return NextResponse.json({error:"Não foi possível criar o pedido"},{status:500});
 }
}
export async function sqliteGetOrders(request: Request) {
 const a=await actor(request);
 if(!a) return NextResponse.json({error:"Faça login para consultar pedidos"},{status:401});
 const params=new URL(request.url).searchParams;
 const admin=params.get("scope")==="admin";
 if(admin&&!a.admin) return NextResponse.json({error:"Acesso restrito ao administrador"},{status:403});
 const offset=Number(params.get("offset")||"0");
 if(!Number.isSafeInteger(offset)||offset<0||offset>1000000) return NextResponse.json({error:"Página inválida"},{status:400});
 const db=sqlite();
 const id=params.get("id");
 const rows=db.prepare(`SELECT * FROM orders WHERE (?=1 OR user_id=?) AND (? IS NULL OR id=?) ORDER BY created_at DESC,id DESC LIMIT 100 OFFSET ?`)
  .all(admin?1:0,a.user.id,id,id,offset) as Row[];
 if(id&&!rows.length) return NextResponse.json({error:"Pedido não encontrado"},{status:404});
 const data=rows.map(r=>orderDetail(db,r));
 if(params.get("pix")==="1"&&data.length===1){
  const order=data[0];
  if(order.status!=="pending") return NextResponse.json({error:"Este pedido não está aguardando Pix"},{status:409});
  if(!order.shipping_address) return NextResponse.json({error:"ADDRESS_REQUIRED",code:"ADDRESS_REQUIRED"},{status:422});
  if(process.env.PAYMENT_PROVIDER==="mercadopago") return NextResponse.json({error:"Use a cobrança do provedor de pagamento"},{status:409});
  const payload=createPixPayload(Math.round(order.total*100),order.id.replace(/-/g,"").slice(0,25));
  return NextResponse.json({payload,qr:await QRCode.toDataURL(payload,{width:512,margin:4}),total:order.total,orderId:order.id,shippingAddress:order.shipping_address});
 }
 return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
}
export async function sqlitePatchOrder(request: Request) {
 try{
  const a=await actor(request);
  if(!a) return NextResponse.json({error:"Faça login"},{status:401});
  if(!a.admin) return NextResponse.json({error:"Acesso restrito ao administrador"},{status:403});
  const body=await request.json();
  if(!uuid.test(body.id||"")||!["paid","shipped","delivered","cancelled"].includes(body.status)||typeof(body.tracking||"")!=="string"||(body.tracking||"").length>100)
   return NextResponse.json({error:"Dados inválidos"},{status:400});
  if(body.status==="paid" && (process.env.PAYMENT_PROVIDER==="mercadopago" || body.paymentVerified!==true))
   return NextResponse.json({error:"Confirmação do pagamento necessária"},{status:403});
  if(body.status==="cancelled"&&process.env.PAYMENT_PROVIDER==="mercadopago")
   return NextResponse.json({error:"Cancelamento exige conciliação"},{status:409});
  sqlite().transaction(()=>{
   const db=sqlite();
   const order=db.prepare("SELECT * FROM orders WHERE id=?").get(body.id) as Row|undefined;
   if(!order) throw new CheckoutError("Pedido não encontrado",404);
   if(order.status===body.status) return;
   const allowed:Record<string,string[]>={pending:["paid","cancelled"],paid:["shipped"],shipped:["delivered"]};
   if(!allowed[order.status]?.includes(body.status)) throw new CheckoutError("Transição de status inválida",409);
   if(body.status==="shipped"&&String(body.tracking||"").trim().length<3) throw new CheckoutError("Informe o rastreio");
   if(body.status==="paid"){
    const items=db.prepare("SELECT product_id,SUM(quantity) qty FROM order_items WHERE order_id=? GROUP BY product_id").all(body.id) as Row[];
    if(!items.length) throw new CheckoutError("Pedido sem itens");
    for(const item of items) {
     if(!item.product_id||db.prepare("UPDATE products SET stock=stock-? WHERE id=? AND stock>=?").run(item.qty,item.product_id,item.qty).changes!==1)
      throw new CheckoutError("Estoque insuficiente",409);
    }
   }
   const field:Record<string,string>={paid:"paid_at",shipped:"shipped_at",delivered:"delivered_at"};
   db.prepare("UPDATE orders SET status=?,tracking_code=CASE WHEN ?='shipped' THEN ? ELSE tracking_code END WHERE id=?")
    .run(body.status,body.status,String(body.tracking||"").trim(),body.id);
   if(field[body.status]) db.prepare(`UPDATE orders SET ${field[body.status]}=CURRENT_TIMESTAMP WHERE id=?`).run(body.id);
   db.prepare("INSERT INTO order_status_history(id,order_id,previous_status,status,changed_by) VALUES (?,?,?,?,?)")
    .run(randomUUID(),body.id,order.status,body.status,a.user.id);
  }).immediate();
  return NextResponse.json({success:true});
 }catch(e){
  if(e instanceof CheckoutError) return NextResponse.json({error:e.message},{status:e.status});
  console.error("SQLite order update error",e);
  return NextResponse.json({error:"Falha ao atualizar pedido"},{status:500});
 }
}
