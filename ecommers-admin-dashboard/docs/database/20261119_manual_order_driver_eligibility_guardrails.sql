-- Manual Order driver eligibility guardrails.
-- Aligns the admin assignment path with normal order requirements:
-- order must be Processing/Shipped; driver must be approved and enabled.

CREATE OR REPLACE FUNCTION public.admin_list_manual_order_drivers()
RETURNS TABLE(driver_user_id uuid,driver_name text,driver_phone text,company_name text,vehicle_type text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' AND (auth.jwt()->>'aal') IS DISTINCT FROM 'aal2'
     AND (SELECT private.has_role('admin'::public.app_role) OR private.has_verified_totp_factor()) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='JTBazar authenticator verification is required.';
  END IF;
  IF NOT(SELECT private.has_role('admin'::public.app_role)) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Administrator access is required.';
  END IF;
  RETURN QUERY SELECT d.user_id,d.full_name,d.phone,d.company_name,d.vehicle_type
    FROM public.driver_applications d
    JOIN public.customer_driver_access cda ON cda.user_id=d.user_id AND cda.enabled
    WHERE d.status='approved' ORDER BY d.full_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_assign_driver_to_manual_order(p_manual_order_id uuid,p_driver_user_id uuid,p_item_ids uuid[])
RETURNS TABLE(assignment_id uuid,cod_due_amount numeric,assigned_item_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_order public.manual_orders%ROWTYPE; v_assignment_id uuid; v_order_subtotal numeric(14,2);
  v_first_assignment boolean; v_item record; v_item_due numeric(14,2); v_first_item boolean:=true;
  v_item_count integer:=0; v_cod_due numeric(14,2):=0; v_total_due numeric(14,2):=0;
  v_merchandise_due numeric(14,2):=0; v_delivery_due numeric(14,2):=0; v_user_id uuid:=auth.uid();
BEGIN
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' AND (auth.jwt()->>'aal') IS DISTINCT FROM 'aal2'
     AND (SELECT private.has_role('admin'::public.app_role) OR private.has_verified_totp_factor()) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='JTBazar authenticator verification is required.';
  END IF;
  IF v_user_id IS NULL OR NOT(SELECT private.has_role('admin'::public.app_role)) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Administrator access is required.';
  END IF;
  IF p_manual_order_id IS NULL OR p_driver_user_id IS NULL OR coalesce(array_length(p_item_ids,1),0)=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Choose an order, approved driver and at least one ready item.';
  END IF;
  SELECT * INTO v_order FROM public.manual_orders WHERE id=p_manual_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Manual order not found.'; END IF;
  IF v_order.order_status NOT IN ('processing','shipped') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Confirm this manual order first by setting its status to Processing or Shipped.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.driver_applications d
    JOIN public.customer_driver_access cda ON cda.user_id=d.user_id AND cda.enabled
    WHERE d.user_id=p_driver_user_id AND d.status='approved'
  ) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Selected driver is not approved or driver access is disabled.'; END IF;
  IF cardinality(p_item_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_item_ids) x) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Duplicate items were selected.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_item_ids) chosen(item_id)
    LEFT JOIN public.manual_order_items moi ON moi.id=chosen.item_id AND moi.manual_order_id=p_manual_order_id
    LEFT JOIN public.manual_order_driver_assignment_items ai ON ai.manual_order_item_id=moi.id
    LEFT JOIN public.manual_order_driver_assignments a ON a.id=ai.assignment_id
    WHERE moi.id IS NULL OR moi.delivery_readiness_status NOT IN ('ready','failed')
      OR (a.id IS NOT NULL AND a.status IN ('assigned','picked_up','delivered'))
  ) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Only ready or previously failed items from this order can be assigned.'; END IF;
  v_order_subtotal:=coalesce(v_order.subtotal,0);
  v_first_assignment:=NOT EXISTS(SELECT 1 FROM public.manual_order_driver_assignments a WHERE a.manual_order_id=p_manual_order_id);
  IF v_order.payment_method IN ('cod','cash') THEN
    v_total_due:=greatest(0,v_order.total-v_order.paid_amount);
    v_delivery_due:=least(v_order.delivery_fee,v_total_due);
    v_merchandise_due:=greatest(0,v_total_due-v_delivery_due);
  END IF;
  INSERT INTO public.manual_order_driver_assignments(manual_order_id,driver_user_id,assigned_by,status)
    VALUES(p_manual_order_id,p_driver_user_id,v_user_id,'assigned') RETURNING id INTO v_assignment_id;
  FOR v_item IN SELECT moi.id,moi.line_total FROM public.manual_order_items moi
    WHERE moi.id=ANY(p_item_ids) AND moi.manual_order_id=p_manual_order_id ORDER BY moi.created_at,moi.id
  LOOP
    IF EXISTS(SELECT 1 FROM public.manual_order_driver_assignment_items ai WHERE ai.manual_order_item_id=v_item.id) THEN
      SELECT ai.cod_due_amount INTO v_item_due FROM public.manual_order_driver_assignment_items ai
      JOIN public.manual_order_driver_assignments a ON a.id=ai.assignment_id
      WHERE ai.manual_order_item_id=v_item.id ORDER BY a.assigned_at DESC LIMIT 1;
    ELSIF v_order.payment_method IN ('cod','cash') AND v_order_subtotal>0 THEN
      v_item_due:=round(v_merchandise_due*v_item.line_total/v_order_subtotal,2);
      IF v_first_assignment AND v_first_item THEN v_item_due:=v_item_due+v_delivery_due; END IF;
    ELSE v_item_due:=0;
    END IF;
    INSERT INTO public.manual_order_driver_assignment_items(assignment_id,manual_order_item_id,cod_due_amount)
      VALUES(v_assignment_id,v_item.id,v_item_due);
    UPDATE public.manual_order_items SET delivery_readiness_status='assigned' WHERE id=v_item.id;
    v_item_count:=v_item_count+1; v_first_item:=false;
  END LOOP;
  SELECT coalesce(sum(ai.cod_due_amount),0)::numeric(14,2) INTO v_cod_due
    FROM public.manual_order_driver_assignment_items ai WHERE ai.assignment_id=v_assignment_id;
  UPDATE public.manual_order_driver_assignments SET cod_due_amount=v_cod_due,updated_at=now() WHERE id=v_assignment_id;
  RETURN QUERY SELECT v_assignment_id,v_cod_due,v_item_count;
END;
$function$;
