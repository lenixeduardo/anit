import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyMercadoPagoSignature } from "@/lib/mercadopago-webhook";

export const dynamic = "force-dynamic";

/** Signed notification + provider-side reconciliation. Requires SQL payment migration. */
export async function POST(request: Request) {
  try {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!token || !secret || !serviceKey || !url) {
      return NextResponse.json({ error: "Payment provider not configured" }, { status: 503 });
    }
    const webhook = await request.json();
    const id = String(webhook?.data?.id ?? "");
    const queryId = new URL(request.url).searchParams.get("data.id") || new URL(request.url).searchParams.get("id");
    if (webhook?.type !== "payment" || !/^\d{1,32}$/.test(id) || queryId !== id) {
      return NextResponse.json({ received: true });
    }
    const requestId = request.headers.get("x-request-id") || "";
    const signature = request.headers.get("x-signature") || "";
    if (!verifyMercadoPagoSignature({ dataId: id, requestId, signature, secret })) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000), cache: "no-store"
    });
    if (!paymentResponse.ok) return NextResponse.json({ error: "Provider unavailable" }, { status: 502 });
    const payment = await paymentResponse.json();
    if (String(payment.id) !== id) return NextResponse.json({ error: "Payment mismatch" }, { status: 409 });
    if (payment.currency_id !== "BRL" || payment.payment_method_id !== "pix") {
      return NextResponse.json({ error: "Payment method mismatch" }, { status: 409 });
    }
    if (!["approved", "cancelled", "rejected"].includes(payment.status)) {
      return NextResponse.json({ received: true });
    }
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.rpc(payment.status === "approved"
      ? "confirm_provider_pix_payment" : "cancel_provider_pix_payment", {
      p_provider_payment_id: id,
      p_order_id: payment.external_reference,
      p_amount: payment.transaction_amount
    });
    if (error) return NextResponse.json({ error: "Payment reconciliation pending" }, { status: 503 });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 503 });
  }
}
