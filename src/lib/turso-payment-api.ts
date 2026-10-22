import "server-only";
import { NextResponse } from "next/server";
import { getSession, safeOrigin } from "@/lib/local-auth";
import { authSchema } from "@/lib/turso";
import { ensureOrderSchema, findUserOrder, findPayment, recordPayment } from "@/lib/turso-orders";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(error:string,status:number)=>NextResponse.json({error},{status});
type Payment={id?:string|number;external_reference?:string;payment_method_id?:string;currency_id?:string;transaction_amount?:number;status?:string;date_of_expiration?:string;point_of_interaction?:{transaction_data?:{qr_code?:string;qr_code_base64?:string}}};
async function fetchPayment(id:string,token:string):Promise<Payment>{
 if(!/^[0-9]{1,32}$/.test(id))throw Error("Invalid provider ID");
 const r=await fetch("https://api.mercadopago.com/v1/payments/"+id,{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error("Provider unavailable");return r.json();
}
function display(p:Payment,orderId:string,cents:number){
 if(String(p.external_reference)!==orderId||p.payment_method_id!=="pix"||p.currency_id!=="BRL"||!Number.isFinite(p.transaction_amount)||Math.round(Number(p.transaction_amount)*100)!==cents)throw Error("Provider payment mismatch");
 const d=p.point_of_interaction?.transaction_data;if(!d?.qr_code)throw Error("Missing provider Pix QR");
 return {orderId,payload:d.qr_code,qr:d.qr_code_base64?"data:image/png;base64,"+d.qr_code_base64:null,status:p.status,expiresAt:p.date_of_expiration};
}
export async function handleTursoPayment(request:Request,method:"GET"|"POST"){
 try{
  if(process.env.PAYMENT_PROVIDER!=="mercadopago")return fail("Pagamento indisponível",503);
  if(method==="POST"&&!safeOrigin(request))return fail("Origem não permitida",403);
  const user=await getSession(request);if(!user)return fail("Faça login",401);
  const token=process.env.MERCADOPAGO_ACCESS_TOKEN;if(!token)return fail("Gateway não configurado",503);
  const body=method==="POST"?await request.json():null;
  const orderId=method==="POST"?String(body?.orderId||""):new URL(request.url).searchParams.get("orderId")||"";
  if(!uuid.test(orderId))return fail("Pedido inválido",400);
  const cpf=String(body?.cpf||"").replace(/[^0-9]/g,"");
  if(method==="POST"&&!/^[0-9]{11}$/.test(cpf))return fail("CPF inválido",400);
  await authSchema();await ensureOrderSchema();
  const order=await findUserOrder(user.id,orderId);
  if(!order||String(order.status)!=="pending")return fail("Pedido não pendente",409);
  const cents=Number(order.total_cents);if(!Number.isSafeInteger(cents)||cents<=0)return fail("Valor inválido",409);
  const existing=await findPayment(orderId);
  if(existing){
   const payment=await fetchPayment(String(existing.provider_payment_id),token);
   return NextResponse.json(display(payment,orderId,cents),{headers:{"Cache-Control":"no-store"}});
  }
  if(method==="GET")return fail("Cobrança não encontrada",404);
  const response=await fetch("https://api.mercadopago.com/v1/payments",{
   method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","X-Idempotency-Key":orderId},
   body:JSON.stringify({transaction_amount:cents/100,description:"Pedido SEVEN "+orderId,payment_method_id:"pix",external_reference:orderId,payer:{email:user.email,identification:{type:"CPF",number:cpf}}}),
   cache:"no-store",signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)return fail("Não foi possível gerar cobrança",502);
  const payment:Payment=await response.json();
  const paymentId=String(payment.id||"");
  if(!/^[0-9]{1,32}$/.test(paymentId))return fail("Resposta inválida do gateway",502);
  const result=display(payment,orderId,cents);
  await recordPayment(orderId,paymentId,cents);
  return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("Turso payment error",error);return fail("Cobrança indisponível ou conciliação pendente",503);}
}
