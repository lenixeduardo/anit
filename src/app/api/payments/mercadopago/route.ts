import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { handleTursoPayment } from "@/lib/turso-payment-api";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchProviderPayment(id: string, token: string) {
  if (!/^\d{1,32}$/.test(id)) throw new Error("Invalid provider payment ID");
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Payment provider unavailable");
  return response.json();
}
function paymentDisplay(payment: { external_reference?: string; payment_method_id?: string; status?: string; date_of_expiration?: string; point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } } }, orderId: string) {
  if (String(payment.external_reference) !== orderId || payment.payment_method_id !== "pix") throw new Error("Provider payment mismatch");
  const details = payment.point_of_interaction?.transaction_data;
  if (!details?.qr_code) throw new Error("Provider QR code unavailable");
  return { orderId, payload: details.qr_code, qr: details.qr_code_base64 ? `data:image/png;base64,${details.qr_code_base64}` : null, status: payment.status, expiresAt: payment.date_of_expiration };
}
export async function GET(request: Request) {
  if(process.env.DATABASE_PROVIDER==="turso") return handleTursoPayment(request,"GET");
  try {
    if (process.env.PAYMENT_PROVIDER !== "mercadopago") return NextResponse.json({error:"Pagamento indisponível"},{status:503});
    const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!bearer) return NextResponse.json({error:"Faça login"},{status:401});
    const {data:{user},error}=await supabase.auth.getUser(bearer);
    if (error || !user) return NextResponse.json({error:"Sessão inválida"},{status:401});
    const orderId=new URL(request.url).searchParams.get("orderId") || "";
    if (!uuid.test(orderId)) return NextResponse.json({error:"Pedido inválido"},{status:400});
    const token=process.env.MERCADOPAGO_ACCESS_TOKEN, key=process.env.SUPABASE_SERVICE_ROLE_KEY, url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!token || !key || !url) return NextResponse.json({error:"Gateway indisponível"},{status:503});
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:order}=await admin.from("orders").select("id,total,status").eq("id",orderId).eq("user_id",user.id).maybeSingle();
    if (!order || order.status!=="pending") return NextResponse.json({error:"Pedido não pendente"},{status:409});
    const {data:record}=await admin.from("payment_transactions").select("provider_payment_id").eq("order_id",orderId).eq("provider","mercadopago").maybeSingle();
    if (!record) return NextResponse.json({error:"Cobrança ainda não localizada"},{status:404});
    const payment=await fetchProviderPayment(record.provider_payment_id,token);
    if (Number(payment.transaction_amount)!==Number(order.total)) return NextResponse.json({error:"Valor divergente"},{status:409});
    const display = paymentDisplay(payment,orderId);
    if (!display.qr) display.qr = await QRCode.toDataURL(display.payload, { width: 512, margin: 4 });
    return NextResponse.json(display,{headers:{"Cache-Control":"no-store"}});
  } catch {return NextResponse.json({error:"Não foi possível recuperar a cobrança"},{status:503});}
}

export async function POST(request: Request) {
  if(process.env.DATABASE_PROVIDER==="turso") return handleTursoPayment(request,"POST");
  try {
    if (process.env.PAYMENT_PROVIDER !== "mercadopago")
      return NextResponse.json({ error: "Pagamentos automáticos indisponíveis" }, { status: 503 });
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!token || !roleKey || !url) return NextResponse.json({ error: "Gateway não configurado" }, { status: 503 });
    const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!bearer) return NextResponse.json({ error: "Login obrigatório" }, { status: 401 });
    const { data: { user }, error: authError } = await supabase.auth.getUser(bearer);
    if (authError || !user?.email) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    const body = await request.json();
    const orderId = String(body?.orderId || "");
    const cpf = String(body?.cpf || "").replace(/\D/g, "");
    if (!uuid.test(orderId) || !/^\d{11}$/.test(cpf))
      return NextResponse.json({ error: "Pedido ou CPF inválido" }, { status: 400 });
    const admin = createClient(url, roleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: order, error: orderError } = await admin.from("orders")
      .select("id,total,status").eq("id",orderId).eq("user_id",user.id).single();
    if (orderError || !order || order.status !== "pending" || Number(order.total) <= 0)
      return NextResponse.json({ error: "Pedido não disponível para cobrança" }, { status: 409 });
    const { data: existing, error: lookupError } = await admin.from("payment_transactions")
      .select("provider_payment_id,status").eq("order_id",orderId).eq("provider","mercadopago").maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Pagamento indisponível" }, { status: 503 });
    if (existing) {
      const payment = await fetchProviderPayment(existing.provider_payment_id, token);
      if (Number(payment.transaction_amount) !== Number(order.total)) return NextResponse.json({error:"Valor divergente"},{status:409});
      return NextResponse.json(paymentDisplay(payment,orderId),{headers:{"Cache-Control":"no-store"}});
    }
    const amount = Number(Number(order.total).toFixed(2));
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": orderId
      },
      body: JSON.stringify({
        transaction_amount: amount, description: `Pedido ANIT ${orderId}`,
        payment_method_id: "pix", external_reference: orderId,
        payer: { email: user.email, identification: { type: "CPF", number: cpf } }
      }),
      cache: "no-store", signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível gerar a cobrança" }, { status: 502 });
    const payment = await response.json();
    const paymentId = String(payment.id || "");
    const qrCode = payment.point_of_interaction?.transaction_data?.qr_code;
    if (!/^\d+$/.test(paymentId) || payment.external_reference !== orderId ||
        Number(payment.transaction_amount) !== amount || !qrCode)
      return NextResponse.json({ error: "Resposta inválida do gateway" }, { status: 502 });
    const { error: storeError } = await admin.from("payment_transactions")
      .insert({ order_id: orderId, provider: "mercadopago", provider_payment_id: paymentId, amount, status: "pending" });
    if (storeError) {
      const { data: recorded } = await admin.from("payment_transactions")
        .select("provider_payment_id").eq("order_id", orderId)
        .eq("provider", "mercadopago").maybeSingle();
      if (recorded?.provider_payment_id !== paymentId) {
        return NextResponse.json({ error: "Conciliação pendente. Não gere outro pedido." }, { status: 503 });
      }
    }
    const display = paymentDisplay(payment,orderId);
    if (!display.qr) display.qr = await QRCode.toDataURL(display.payload, { width: 512, margin: 4 });
    return NextResponse.json(display, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível processar a cobrança" }, { status: 503 });
  }
}
