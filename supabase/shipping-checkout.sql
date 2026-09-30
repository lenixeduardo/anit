-- Aplicar antes de ativar SHIPPING_ENABLED=true.
BEGIN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight_kg numeric CHECK (weight_kg > 0);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS height_cm numeric CHECK (height_cm > 0);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS width_cm numeric CHECK (width_cm > 0);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS length_cm numeric CHECK (length_cm > 0);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_details jsonb;
CREATE TABLE IF NOT EXISTS public.shipping_quotes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 items jsonb NOT NULL, postal_code text NOT NULL CHECK (postal_code ~ '^[0-9]{8}$'),
 service_id text NOT NULL CHECK (service_id IN ('1','2')), service_name text NOT NULL,
 price numeric NOT NULL CHECK (price >= 0), delivery_days integer NOT NULL CHECK (delivery_days > 0),
 expires_at timestamptz NOT NULL, sandbox boolean NOT NULL DEFAULT false
);
ALTER TABLE public.shipping_quotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shipping_quotes FROM anon, authenticated;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
 EXECUTE 'GRANT SELECT, INSERT, DELETE ON public.shipping_quotes TO service_role';
END IF; END $$;
DROP FUNCTION IF EXISTS public.create_pix_order(uuid,jsonb,text);
-- Endereço obrigatório para novos pedidos. Preserva o histórico anterior.
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

CREATE OR REPLACE FUNCTION public.create_pix_order(p_id uuid, p_items jsonb, p_coupon text DEFAULT '', p_shipping_quote uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing public.orders;
  quote public.shipping_quotes;
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
    RETURN jsonb_build_object('orderId', existing.id, 'total', existing.total, 'status', existing.status, 'shippingDetails',existing.shipping_details,'shippingAddress', existing.shipping_address);
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
  SELECT * INTO quote FROM public.shipping_quotes WHERE id=p_shipping_quote AND user_id=auth.uid();
  IF NOT FOUND OR quote.expires_at <= now() OR quote.sandbox THEN RAISE EXCEPTION 'Calcule e selecione um frete válido'; END IF;
  IF quote.postal_code <> address->>'postal_code' THEN RAISE EXCEPTION 'Endereço alterado. Calcule o frete novamente'; END IF;
  IF quote.items <> (SELECT jsonb_agg(jsonb_build_object('id',n->>'id','qty',(n->>'qty')::integer) ORDER BY n->>'id') FROM jsonb_array_elements(normalized) n) THEN RAISE EXCEPTION 'Carrinho alterado. Calcule o frete novamente'; END IF;
  shipping := quote.price;
  INSERT INTO public.orders(id, user_id, total, status, shipping_address, shipping_details)
    VALUES(p_id, auth.uid(), subtotal - discount + shipping, 'pending', address, jsonb_build_object('quoteId',quote.id,'postalCode',quote.postal_code,'serviceId',quote.service_id,'name',quote.service_name,'price',quote.price,'days',quote.delivery_days));
  INSERT INTO public.order_items(order_id, product_id, quantity, price)
    SELECT p_id, (n->>'id')::uuid, (n->>'qty')::integer, (n->>'price')::numeric FROM jsonb_array_elements(normalized) n;
  RETURN jsonb_build_object('orderId', p_id, 'total', subtotal - discount + shipping, 'subtotal', subtotal, 'discount', discount, 'shipping', shipping, 'shippingDetails',(SELECT shipping_details FROM public.orders WHERE id=p_id), 'status', 'pending', 'shippingAddress', address);
END;
$$;
REVOKE ALL ON FUNCTION public.create_pix_order(uuid, jsonb, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pix_order(uuid, jsonb, text, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
