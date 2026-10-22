import { NextResponse } from "next/server";
import { shippingEnabled } from "@/lib/shipping-config";

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    shippingEnabled,
    databaseProvider: process.env.DATABASE_PROVIDER === "turso" ? "turso" : "legacy",
    paymentProvider: process.env.PAYMENT_PROVIDER === 'mercadopago' ? 'mercadopago' : 'legacy'
  });
}
