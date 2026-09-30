BEGIN;
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
COMMIT;
