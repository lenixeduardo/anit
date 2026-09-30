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
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Inserção de Produtos Iniciais do Catálogo
INSERT INTO public.products (name, description, price, image_url, category, stock)
VALUES
('Bong Straight Crystal', 'Bong reto em vidro borosilicato com percolador tree e base disco. Filtragem superior para uma sessão suave.', 189.90, 'assets/produto-bong-cylinder.jpeg', 'bong', 15),
('Sapatinho Crystal Bong', 'O icônico bong em formato de sapato de cristal com detalhe joia dourado — a peça mais exclusiva da coleção Tynderella.', 249.90, 'assets/produto-bong-heel.jpeg', 'bong', 5),
('Bong Maçã Encantada', 'Bong artesanal em formato de maçã com corpo em vidro vermelho e folha verde soprada à mão.', 169.90, 'assets/produto-bong-apple.jpeg', 'bong', 10),
('Bong Sapphire Tower', 'Bong cilíndrico em vidro borosilicato com câmara dupla e percolador tree.', 219.90, 'assets/produto-bong-blue.png', 'bong', 8),
('Bowl Cobra Azul', 'Bowl artesanal em vidro azul cobalto com design curvo estilo cobra. Encaixe 14mm.', 49.90, 'assets/produto-bowl-blue.png', 'bowl', 30),
('Maçarico Slim Trio', 'Maçarico slim de chama azul intensa disponível em dourado, preto e azul. Recarregável e compacto.', 59.90, 'assets/produto-torch-slim.png', 'macarico', 25),
('Maçarico Titanium Pro', 'Maçarico tático em titânio escovado com dupla chama e clip de bolso.', 89.90, 'assets/produto-torch-silver.png', 'macarico', 20),
('Bowl Caveira Crystal Blue', 'Bowl em vidro azul safira com escultura de caveira detalhada. Encaixe 14mm.', 54.90, 'assets/produto-bowl-skull.png', 'bowl', 18)
ON CONFLICT DO NOTHING;
