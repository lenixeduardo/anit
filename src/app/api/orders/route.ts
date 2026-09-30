export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_email, items, total } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing order items" }, { status: 400 });
    }

    // 1. Encontra o usuário na tabela profiles com base no email (caso esteja logado)
    let user_id = null;
    if (user_email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", user_email)
        .single();

      if (profile) {
        user_id = profile.id;
      }
    }

    // 2. Insere o pedido na tabela public.orders
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user_id,
        total: total,
        status: "pending"
      })
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // 3. Resolve IDs dos produtos e insere na tabela public.order_items
    const orderItemsToInsert = [];
    for (const item of items) {
      // Tenta achar o produto pelo nome no banco
      const { data: product } = await supabase
        .from("products")
        .select("id, price")
        .eq("name", item.name)
        .single();

      orderItemsToInsert.push({
        order_id: order.id,
        product_id: product ? product.id : null,
        quantity: item.qty || 1,
        price: product ? product.price : parseFloat(item.price.replace("R$", "").replace(",", ".").trim())
      });
    }

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsToInsert);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET handler para o admin consultar o histórico de pedidos
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        id,
        total,
        status,
        created_at,
        profiles (
          name,
          email
        ),
        order_items (
          id,
          quantity,
          price,
          products (
            name
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(orders);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
