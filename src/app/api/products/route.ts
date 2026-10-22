export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sqlite, sqliteEnabled, publicProduct } from "@/lib/sqlite";
export const runtime = "nodejs";

export async function GET() {
  try {
    if (sqliteEnabled) {
      const rows = sqlite().prepare("SELECT * FROM products ORDER BY name ASC").all() as Record<string, unknown>[];
      return NextResponse.json(rows.map(publicProduct));
    }
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
