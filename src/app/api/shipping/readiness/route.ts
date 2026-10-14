import { NextResponse } from "next/server";
import { supabase, createAuthenticatedClient } from "@/lib/supabase";
import { shippingEnabled } from "@/lib/shipping-config";

export const dynamic = "force-dynamic";

/** Admin-only, non-secret diagnostics. Does not call the carrier or create shipments. */
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: "Autenticação obrigatória" }, { status: 401 });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  const client = createAuthenticatedClient(token);
  const { data: profile, error: profileError } = await client.from("profiles")
    .select("role").eq("id", user.id).single();
  if (profileError || profile?.role !== "admin")
    return NextResponse.json({ error: "Acesso administrativo obrigatório" }, { status: 403 });

  const originConfigured = /^\d{8}$/.test(process.env.SHIPPING_ORIGIN_POSTAL_CODE || "");
  const tokenConfigured = Boolean(process.env.MELHOR_ENVIO_TOKEN);
  const agentConfigured = Boolean(process.env.MELHOR_ENVIO_USER_AGENT);
  const sandbox = process.env.MELHOR_ENVIO_SANDBOX === "true";
  const serviceKeyConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return NextResponse.json({
    shippingEnabled,
    sandbox,
    configuration: { originConfigured, tokenConfigured, agentConfigured, serviceKeyConfigured },
    readyForLiveQuotes: shippingEnabled && !sandbox && originConfigured && tokenConfigured &&
      agentConfigured && serviceKeyConfigured,
    labelPurchaseImplemented: false,
    warning: "Esta verificação avalia apenas configuração. Não comprova validade das credenciais, atendimento dos CEPs ou medidas dos produtos."
  }, { headers: { "Cache-Control": "no-store" } });
}
