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
