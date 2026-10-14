-- Fase 2: o status 'paid' só pode ser confirmado após conciliação do provedor.
-- Execute após setup-anit.sql e order-management.sql, sem dados reais não auditados.
BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider = 'mercadopago'),
  provider_payment_id text NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  UNIQUE(provider,provider_payment_id),
  UNIQUE(order_id,provider)
);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.payment_transactions TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_provider_pix_payment(
  p_provider_payment_id text, p_order_id uuid, p_amount numeric
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE payment public.payment_transactions; ord public.orders; item record;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Privileged operation only'; END IF;
  SELECT * INTO ord FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR ord.total <> p_amount THEN RAISE EXCEPTION 'Amount mismatch'; END IF;
  INSERT INTO public.payment_transactions(order_id,provider,provider_payment_id,amount)
  VALUES(p_order_id,'mercadopago',p_provider_payment_id,p_amount)
  ON CONFLICT (order_id,provider) DO NOTHING;
  SELECT * INTO payment FROM public.payment_transactions
  WHERE provider='mercadopago' AND provider_payment_id=p_provider_payment_id AND order_id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conflicting payment'; END IF;
  IF ord.total <> p_amount OR payment.amount <> p_amount THEN
    RAISE EXCEPTION 'Payment amount mismatch';
  END IF;
  IF payment.status='paid' AND ord.status IN ('paid','shipped','delivered') THEN RETURN true; END IF;
  IF payment.status <> 'pending' OR ord.status <> 'pending' THEN RAISE EXCEPTION 'Invalid payment transition'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=p_order_id) THEN RAISE EXCEPTION 'Order without items'; END IF;
  FOR item IN SELECT product_id, sum(quantity)::integer AS quantity
    FROM public.order_items WHERE order_id=p_order_id GROUP BY product_id ORDER BY product_id LOOP
    UPDATE public.products SET stock=stock-item.quantity
    WHERE id=item.product_id AND stock>=item.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient inventory'; END IF;
  END LOOP;
  UPDATE public.orders SET status='paid',paid_at=now() WHERE id=p_order_id;
  UPDATE public.payment_transactions SET status='paid',paid_at=now() WHERE id=payment.id;
  INSERT INTO public.order_status_history(order_id,previous_status,status,changed_by)
    VALUES(p_order_id,'pending','paid',NULL);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_provider_pix_payment(text,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_provider_pix_payment(text,uuid,numeric) TO service_role;
CREATE OR REPLACE FUNCTION public.cancel_provider_pix_payment(
  p_provider_payment_id text, p_order_id uuid, p_amount numeric
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $
DECLARE payment public.payment_transactions; ord public.orders;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Privileged operation only'; END IF;
  SELECT * INTO ord FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR ord.total <> p_amount THEN RAISE EXCEPTION 'Order amount mismatch'; END IF;
  INSERT INTO public.payment_transactions(order_id,provider,provider_payment_id,amount)
  VALUES(p_order_id,'mercadopago',p_provider_payment_id,p_amount)
  ON CONFLICT (order_id,provider) DO NOTHING;
  SELECT * INTO payment FROM public.payment_transactions
  WHERE provider='mercadopago' AND provider_payment_id=p_provider_payment_id
    AND order_id=p_order_id FOR UPDATE;
  IF NOT FOUND OR payment.amount <> p_amount THEN RAISE EXCEPTION 'Conflicting payment'; END IF;
  IF payment.status='cancelled' AND ord.status='cancelled' THEN RETURN true; END IF;
  IF payment.status <> 'pending' OR ord.status <> 'pending' THEN
    RAISE EXCEPTION 'Cancellation needs review';
  END IF;
  UPDATE public.orders SET status='cancelled' WHERE id=p_order_id;
  UPDATE public.payment_transactions SET status='cancelled' WHERE id=payment.id;
  INSERT INTO public.order_status_history(order_id,previous_status,status,changed_by)
  VALUES(p_order_id,'pending','cancelled',NULL);
  RETURN true;
END;
$;
REVOKE ALL ON FUNCTION public.cancel_provider_pix_payment(text,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_provider_pix_payment(text,uuid,numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
