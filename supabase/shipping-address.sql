-- Endereço obrigatório para novos pedidos. Preserva o histórico anterior.
BEGIN;
CREATE OR REPLACE FUNCTION public.is_valid_shipping_address(address jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_typeof(address) = 'object'
    AND (SELECT bool_and(coalesce(jsonb_typeof(address->key) = 'string'
      AND length(btrim(address->>key)) BETWEEN 1 AND 200, false))
      FROM unnest(ARRAY['recipient','postal_code','street','number','neighborhood','city','state']) AS key)
    AND address->>'postal_code' ~ '^[0-9]{8}$'
    AND address->>'postal_code' <> '00000000'
    AND address->>'state' IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
    AND (NOT address ? 'complement' OR (jsonb_typeof(address->'complement') = 'string' AND length(address->>'complement') <= 200)), false);
$$;
REVOKE ALL ON FUNCTION public.is_valid_shipping_address(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_valid_shipping_address(jsonb) TO authenticated;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shipping_address jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address jsonb;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_shipping_address_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_shipping_address_check
  CHECK (shipping_address IS NULL OR public.is_valid_shipping_address(shipping_address));
GRANT UPDATE (shipping_address) ON public.profiles TO authenticated;

-- Protege também inserções privilegiadas e mantém a cópia do endereço imutável.
CREATE OR REPLACE FUNCTION public.protect_order_address()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT public.is_valid_shipping_address(NEW.shipping_address) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADDRESS_REQUIRED';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.shipping_address IS DISTINCT FROM OLD.shipping_address THEN
    RAISE EXCEPTION 'O endereço registrado no pedido não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_order_address() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_order_address ON public.orders;
CREATE TRIGGER protect_order_address BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_order_address();

CREATE OR REPLACE FUNCTION public.create_pix_order(p_id uuid, p_items jsonb, p_coupon text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing public.orders;
  row_item jsonb;
  product public.products;
  address jsonb;
  quantity integer;
  subtotal numeric := 0;
  discount numeric := 0;
  shipping numeric := 0;
  normalized jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para finalizar'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  SELECT * INTO existing FROM public.orders WHERE id = p_id AND user_id = auth.uid();
  IF FOUND THEN
    IF existing.status <> 'pending' THEN RAISE EXCEPTION 'Pedido não está aguardando pagamento'; END IF;
    IF NOT public.is_valid_shipping_address(existing.shipping_address) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADDRESS_REQUIRED';
    END IF;
    RETURN jsonb_build_object('orderId', existing.id, 'total', existing.total, 'status', existing.status, 'shippingAddress', existing.shipping_address);
  END IF;
  SELECT shipping_address INTO address FROM public.profiles WHERE id = auth.uid() FOR SHARE;
  IF NOT public.is_valid_shipping_address(address) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ADDRESS_REQUIRED';
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
  INSERT INTO public.orders(id, user_id, total, status, shipping_address)
    VALUES(p_id, auth.uid(), subtotal - discount + shipping, 'pending', address);
  INSERT INTO public.order_items(order_id, product_id, quantity, price)
    SELECT p_id, (n->>'id')::uuid, (n->>'qty')::integer, (n->>'price')::numeric FROM jsonb_array_elements(normalized) n;
  RETURN jsonb_build_object('orderId', p_id, 'total', subtotal - discount + shipping, 'subtotal', subtotal, 'discount', discount, 'shipping', shipping, 'status', 'pending', 'shippingAddress', address);
END;
$$;
REVOKE ALL ON FUNCTION public.create_pix_order(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pix_order(uuid, jsonb, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
