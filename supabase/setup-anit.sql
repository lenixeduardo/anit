-- Executar uma vez em um projeto Supabase novo. Não inclui produtos de exemplo.
BEGIN;
-- 1. Habilitar a extensão uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Perfis de Usuários (sincronizada com o Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    consented_at TIMESTAMP WITH TIME ZONE,
    privacy_policy_version TEXT DEFAULT '1.0',
    terms_accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migração segura: adiciona colunas LGPD se ainda não existirem (para bancos já criados)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='consented_at') THEN
    ALTER TABLE public.profiles ADD COLUMN consented_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.profiles ADD COLUMN privacy_policy_version TEXT DEFAULT '1.0';
    ALTER TABLE public.profiles ADD COLUMN terms_accepted BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 3. Tabela de Produtos
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    image_url TEXT,
    category TEXT NOT NULL CHECK (category IN ('bong', 'macarico', 'bowl')),
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Pedidos
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
    total NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Itens do Pedido
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price NUMERIC(10, 2) NOT NULL
);

-- 6. Habilitar Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 7. Políticas de Acesso

-- Função auxiliar (SECURITY DEFINER) para verificar se o usuário atual é admin.
-- O SECURITY DEFINER evita recursão infinita ao consultar profiles dentro de uma policy de profiles.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Perfis: usuário lê/edita apenas o próprio; admin lê todos.
DROP POLICY IF EXISTS "Allow public read for profiles" ON public.profiles;
CREATE POLICY "Allow users to read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_current_user_admin());
CREATE POLICY "Allow users to update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow system profile creation" ON public.profiles FOR INSERT WITH CHECK (true);

-- Produtos: Qualquer um pode ler; Somente Admins podem alterar/inserir/deletar.
CREATE POLICY "Allow public read for products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow admin write access to products" ON public.products FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Pedidos: Usuário lê seus próprios pedidos; Admin lê todos.
CREATE POLICY "Allow users to read own orders" ON public.orders FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);
CREATE POLICY "Allow authenticated users to create orders" ON public.orders FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- Itens de Pedido: Seguem a mesma lógica da tabela pai (orders)
CREATE POLICY "Allow users to read own order items" ON public.order_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = order_items.order_id AND (orders.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
    )
);
CREATE POLICY "Allow order items insertions" ON public.order_items FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
);

-- Tabela de Audit Logs (LGPD — rastreio de acesso e modificações em dados pessoais)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read audit logs" ON public.audit_logs
  FOR SELECT USING (public.is_current_user_admin());

-- 8. Trigger para criar perfil automaticamente no SignUp
-- Captura dados de consentimento LGPD passados via user_metadata no signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, consented_at, privacy_policy_version, terms_accepted)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Princesa'),
    new.email,
    'user',
    CASE
      WHEN (new.raw_user_meta_data->>'terms_accepted')::boolean = true
      THEN (new.raw_user_meta_data->>'consented_at')::timestamp with time zone
      ELSE NULL
    END,
    COALESCE(new.raw_user_meta_data->>'privacy_policy_version', '1.0'),
    COALESCE((new.raw_user_meta_data->>'terms_accepted')::boolean, false)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Aplicar depois do schema base. Apenas o backend privilegiado atribui admins.
DROP POLICY IF EXISTS "Allow system profile creation" ON public.profiles;
CREATE POLICY "Allow own profile creation" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id AND role = 'user');

CREATE OR REPLACE FUNCTION public.protect_profile_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' AND NEW.role <> 'user' THEN
      RAISE EXCEPTION 'Atribuição de administrador exige acesso privilegiado';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.id IS DISTINCT FROM OLD.id) THEN
      RAISE EXCEPTION 'Identidade e função não podem ser alteradas pelo cliente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_profile_identity ON public.profiles;
CREATE TRIGGER protect_profile_identity BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_identity();

-- Pedidos e preços só podem ser gravados pelas funções validadas.
REVOKE INSERT,UPDATE,DELETE ON public.orders,public.order_items FROM anon,authenticated;


ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending','paid','shipped','delivered','cancelled'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status text NOT NULL, status text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own order history" ON public.order_status_history;
CREATE POLICY "Read own order history" ON public.order_status_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_current_user_admin()))
);
CREATE OR REPLACE FUNCTION public.update_order_status(p_id uuid, p_status text, p_tracking text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_order public.orders; item record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT * INTO current_order FROM public.orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF current_order.status = p_status THEN RETURN jsonb_build_object('success',true); END IF;
  IF NOT ((current_order.status = 'pending' AND p_status IN ('paid','cancelled')) OR
      (current_order.status = 'paid' AND p_status = 'shipped') OR
      (current_order.status = 'shipped' AND p_status = 'delivered')) THEN RAISE EXCEPTION 'Transição de status inválida'; END IF;
  IF p_status = 'shipped' AND (length(trim(p_tracking)) < 3 OR length(p_tracking) > 100) THEN RAISE EXCEPTION 'Informe o código de rastreio'; END IF;
  IF p_status = 'paid' THEN
    IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_id) THEN RAISE EXCEPTION 'Pedido sem itens'; END IF;
    FOR item IN SELECT product_id,sum(quantity)::integer AS quantity FROM public.order_items WHERE order_id=p_id GROUP BY product_id ORDER BY product_id LOOP
      UPDATE public.products SET stock = stock - item.quantity WHERE id=item.product_id AND stock >= item.quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'Estoque insuficiente. Resolva antes de confirmar o pagamento'; END IF;
    END LOOP;
  END IF;
  UPDATE public.orders SET status=p_status,
    tracking_code=CASE WHEN p_status='shipped' THEN trim(p_tracking) ELSE tracking_code END,
    paid_at=CASE WHEN p_status='paid' THEN now() ELSE paid_at END,
    shipped_at=CASE WHEN p_status='shipped' THEN now() ELSE shipped_at END,
    delivered_at=CASE WHEN p_status='delivered' THEN now() ELSE delivered_at END WHERE id=p_id;
  INSERT INTO public.order_status_history(order_id,previous_status,status,changed_by) VALUES(p_id,current_order.status,p_status,auth.uid());
  RETURN jsonb_build_object('success',true);
END;
$$;
REVOKE ALL ON FUNCTION public.update_order_status(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid,text,text) TO authenticated;
-- Explicit Data API grants, constrained by RLS policies.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT ON public.profiles TO authenticated;
GRANT UPDATE (name, consented_at, privacy_policy_version, terms_accepted) ON public.profiles TO authenticated;
GRANT SELECT ON public.orders, public.order_items, public.order_status_history, public.audit_logs TO authenticated;
REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user(), public.protect_profile_identity() FROM PUBLIC, anon, authenticated;
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
-- Aplicar antes de publicar a integração de frete.
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


NOTIFY pgrst, 'reload schema';
COMMIT;
