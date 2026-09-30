BEGIN;
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
