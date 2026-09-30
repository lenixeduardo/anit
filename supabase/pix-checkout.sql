-- Execute no SQL Editor do Supabase antes de aceitar pedidos Pix.
CREATE OR REPLACE FUNCTION public.create_pix_order(p_id uuid, p_items jsonb, p_coupon text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing public.orders;
  row_item jsonb;
  product public.products;
  quantity integer;
  subtotal numeric := 0;
  discount numeric := 0;
  shipping numeric := 0;
  normalized jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para finalizar'; END IF;
  -- Serializa tentativas com o mesmo identificador, inclusive de abas diferentes.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  SELECT * INTO existing FROM public.orders WHERE id = p_id AND user_id = auth.uid();
  IF FOUND THEN
    IF existing.status <> 'pending' THEN RAISE EXCEPTION 'Pedido não está aguardando pagamento'; END IF;
    RETURN jsonb_build_object('orderId', existing.id, 'total', existing.total, 'status', existing.status);
  END IF;
  IF p_id IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Carrinho inválido';
  END IF;
  IF p_coupon NOT IN ('', 'PRINCESS10') THEN RAISE EXCEPTION 'Cupom inválido'; END IF;
  FOR row_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    quantity := (row_item->>'qty')::integer;
    IF quantity IS NULL OR quantity NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT * INTO product FROM public.products WHERE id = (row_item->>'id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(normalized) n WHERE n->>'id' = product.id::text) THEN
      RAISE EXCEPTION 'Produto repetido';
    END IF;
    IF product.stock < quantity OR product.price <= 0 THEN RAISE EXCEPTION 'Estoque insuficiente ou preço indisponível: %', product.name; END IF;
    subtotal := subtotal + product.price * quantity;
    normalized := normalized || jsonb_build_array(jsonb_build_object('id', product.id, 'qty', quantity, 'price', product.price));
  END LOOP;
  discount := CASE WHEN p_coupon = 'PRINCESS10' THEN round(subtotal * 0.1, 2) ELSE 0 END;
  shipping := CASE WHEN subtotal >= 200 THEN 0 ELSE 18.90 END;
  INSERT INTO public.orders(id, user_id, total, status) VALUES(p_id, auth.uid(), subtotal - discount + shipping, 'pending');
  INSERT INTO public.order_items(order_id, product_id, quantity, price)
    SELECT p_id, (n->>'id')::uuid, (n->>'qty')::integer, (n->>'price')::numeric FROM jsonb_array_elements(normalized) n;
  RETURN jsonb_build_object('orderId', p_id, 'total', subtotal - discount + shipping, 'subtotal', subtotal, 'discount', discount, 'shipping', shipping, 'status', 'pending');
END;
$$;
REVOKE ALL ON FUNCTION public.create_pix_order(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pix_order(uuid, jsonb, text) TO authenticated;

-- Pedidos e preços só podem ser gravados pelas funções validadas.
REVOKE INSERT,UPDATE,DELETE ON public.orders,public.order_items FROM anon,authenticated;
