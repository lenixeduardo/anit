import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
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
    if (existing) return NextResponse.json({ error: "Cobrança já criada para este pedido", code: "PAYMENT_ALREADY_EXISTS" }, { status: 409 });
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
    const qrBase64 = payment.point_of_interaction?.transaction_data?.qr_code_base64;
    if (!/^\d+$/.test(paymentId) || payment.external_reference !== orderId ||
        Number(payment.transaction_amount) !== amount || !qrCode)
      return NextResponse.json({ error: "Resposta inválida do gateway" }, { status: 502 });
    const { error: storeError } = await admin.from("payment_transactions")
      .insert({ order_id: orderId, provider: "mercadopago", provider_payment_id: paymentId, amount, status: "pending" });
    if (storeError) return NextResponse.json({ error: "Cobrança criada; conciliação pendente. Não gere outro pedido." }, { status: 503 });
    return NextResponse.json({ orderId, payload: qrCode, qr: qrBase64 ? `data:image/png;base64,${qrBase64}` : null, status: "pending" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível processar a cobrança" }, { status: 503 });
  }
}
