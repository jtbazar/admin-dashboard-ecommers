-- JTBazar Manual Orders: Phase 1 database support (admin + fulfilment).
-- Isolated from public.orders, delivery_batches and driver_assignments.
-- Apply once to the JTBazar Supabase project.

ALTER TABLE public.manual_order_items
  ADD COLUMN IF NOT EXISTS vendor_approval_status text NOT NULL DEFAULT 'not_required'
    CHECK (vendor_approval_status IN ('not_required','pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS delivery_readiness_status text NOT NULL DEFAULT 'ready'
    CHECK (delivery_readiness_status IN ('not_ready','ready','assigned','picked_up','delivered','failed')),
  ADD COLUMN IF NOT EXISTS vendor_approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS vendor_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_approval_note text;

UPDATE public.manual_order_items
SET vendor_approval_status=CASE WHEN seller_id IS NULL THEN 'not_required' ELSE 'pending' END,
    delivery_readiness_status=CASE WHEN seller_id IS NULL THEN 'ready' ELSE 'not_ready' END;

CREATE OR REPLACE FUNCTION public.initialize_manual_order_item_fulfillment()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  IF NEW.seller_id IS NULL THEN
    NEW.vendor_approval_status:='not_required'; NEW.delivery_readiness_status:='ready';
  ELSE
    NEW.vendor_approval_status:='pending'; NEW.delivery_readiness_status:='not_ready';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS manual_order_item_fulfillment_init ON public.manual_order_items;
CREATE TRIGGER manual_order_item_fulfillment_init BEFORE INSERT ON public.manual_order_items
FOR EACH ROW EXECUTE FUNCTION public.initialize_manual_order_item_fulfillment();

CREATE TABLE IF NOT EXISTS public.manual_order_driver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_order_id uuid NOT NULL REFERENCES public.manual_orders(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id),
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','picked_up','delivered','failed','cancelled')),
  cod_due_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(cod_due_amount>=0),
  cod_collected_amount numeric(14,2) CHECK(cod_collected_amount IS NULL OR cod_collected_amount>=0),
  cod_collected_at timestamptz, picked_up_at timestamptz, delivered_at timestamptz,
  failed_reason text, failed_note text, delivery_proof_path text,
  cash_reconciled_amount numeric(14,2), cash_reconciled_at timestamptz,
  cash_reconciled_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.manual_order_driver_assignment_items (
  assignment_id uuid NOT NULL REFERENCES public.manual_order_driver_assignments(id) ON DELETE CASCADE,
  manual_order_item_id uuid NOT NULL REFERENCES public.manual_order_items(id) ON DELETE RESTRICT,
  cod_due_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(cod_due_amount>=0),
  PRIMARY KEY(assignment_id,manual_order_item_id)
);
CREATE INDEX IF NOT EXISTS manual_order_driver_assignments_order_idx ON public.manual_order_driver_assignments(manual_order_id,assigned_at DESC);
CREATE INDEX IF NOT EXISTS manual_order_driver_assignments_driver_idx ON public.manual_order_driver_assignments(driver_user_id,status,assigned_at DESC);
CREATE INDEX IF NOT EXISTS manual_order_driver_assignment_items_item_idx ON public.manual_order_driver_assignment_items(manual_order_item_id);

ALTER TABLE public.manual_order_driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_order_driver_assignment_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS manual_order_driver_assignments_admin_read ON public.manual_order_driver_assignments;
CREATE POLICY manual_order_driver_assignments_admin_read ON public.manual_order_driver_assignments
FOR SELECT TO authenticated USING((SELECT private.has_role('admin'::public.app_role)));
DROP POLICY IF EXISTS manual_order_driver_assignment_items_admin_read ON public.manual_order_driver_assignment_items;
CREATE POLICY manual_order_driver_assignment_items_admin_read ON public.manual_order_driver_assignment_items
FOR SELECT TO authenticated USING((SELECT private.has_role('admin'::public.app_role)));

CREATE OR REPLACE FUNCTION public.guard_manual_order_item_delete_after_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF EXISTS(SELECT 1 FROM public.manual_order_driver_assignment_items ai WHERE ai.manual_order_item_id=OLD.id) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='This manual order item has driver assignment history and cannot be edited or removed. Create a new manual order instead.';
  END IF;
  RETURN OLD;
END;
$function$;
DROP TRIGGER IF EXISTS manual_order_item_assignment_delete_guard ON public.manual_order_items;
CREATE TRIGGER manual_order_item_assignment_delete_guard BEFORE DELETE ON public.manual_order_items
FOR EACH ROW EXECUTE FUNCTION public.guard_manual_order_item_delete_after_assignment();

CREATE OR REPLACE FUNCTION public.guard_manual_order_delete_after_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF EXISTS(SELECT 1 FROM public.manual_order_driver_assignments a WHERE a.manual_order_id=OLD.id) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='This manual order has driver assignment history and cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$function$;
DROP TRIGGER IF EXISTS manual_order_assignment_delete_guard ON public.manual_orders;
CREATE TRIGGER manual_order_assignment_delete_guard BEFORE DELETE ON public.manual_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_manual_order_delete_after_assignment();

CREATE OR REPLACE FUNCTION public.admin_update_manual_order_item_fulfillment(p_item_id uuid,p_action text,p_note text DEFAULT NULL)
RETURNS TABLE(item_id uuid,vendor_approval_status text,delivery_readiness_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_item public.manual_order_items%ROWTYPE; v_user_id uuid:=auth.uid();
BEGIN
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' AND (auth.jwt()->>'aal') IS DISTINCT FROM 'aal2'
     AND (SELECT private.has_role('admin'::public.app_role) OR private.has_verified_totp_factor()) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='JTBazar authenticator verification is required.';
  END IF;
  IF v_user_id IS NULL OR NOT(SELECT private.has_role('admin'::public.app_role)) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Administrator access is required.';
  END IF;
  SELECT * INTO v_item FROM public.manual_order_items WHERE id=p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Manual order item not found.'; END IF;
  IF EXISTS(SELECT 1 FROM public.manual_order_driver_assignment_items ai JOIN public.manual_order_driver_assignments a ON a.id=ai.assignment_id
    WHERE ai.manual_order_item_id=p_item_id AND a.status IN('assigned','picked_up','delivered')) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='This item already has an active or completed driver assignment.';
  END IF;
  IF p_action='vendor_approved' THEN
    IF v_item.seller_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='This item does not require vendor approval.'; END IF;
    UPDATE public.manual_order_items SET vendor_approval_status='approved',vendor_approved_by=v_user_id,
      vendor_approved_at=now(),vendor_approval_note=nullif(btrim(coalesce(p_note,'')),'') WHERE id=p_item_id;
  ELSIF p_action='vendor_rejected' THEN
    IF v_item.seller_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='This item does not require vendor approval.'; END IF;
    UPDATE public.manual_order_items SET vendor_approval_status='rejected',vendor_approved_by=v_user_id,
      vendor_approved_at=now(),vendor_approval_note=nullif(btrim(coalesce(p_note,'')),''),
      delivery_readiness_status='not_ready' WHERE id=p_item_id;
  ELSIF p_action='mark_ready' THEN
    IF v_item.seller_id IS NOT NULL AND v_item.vendor_approval_status<>'approved' THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Vendor approval must be recorded before this item can be marked ready.';
    END IF;
    UPDATE public.manual_order_items SET delivery_readiness_status='ready' WHERE id=p_item_id;
  ELSE
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Unsupported manual order item action.';
  END IF;
  RETURN QUERY SELECT moi.id,moi.vendor_approval_status,moi.delivery_readiness_status FROM public.manual_order_items moi WHERE moi.id=p_item_id;
END;
$function$;

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
    FROM public.driver_applications d WHERE d.status='approved' ORDER BY d.full_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_manual_order_driver_assignments(p_order_id uuid)
RETURNS TABLE(assignment_id uuid,driver_user_id uuid,driver_name text,driver_phone text,assignment_status text,
 cod_due_amount numeric,cod_collected_amount numeric,assigned_at timestamptz,picked_up_at timestamptz,delivered_at timestamptz,
 failed_reason text,failed_note text,item_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' AND (auth.jwt()->>'aal') IS DISTINCT FROM 'aal2'
     AND (SELECT private.has_role('admin'::public.app_role) OR private.has_verified_totp_factor()) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='JTBazar authenticator verification is required.';
  END IF;
  IF NOT(SELECT private.has_role('admin'::public.app_role)) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Administrator access is required.';
  END IF;
  RETURN QUERY SELECT a.id,a.driver_user_id,d.full_name,d.phone,a.status,a.cod_due_amount,a.cod_collected_amount,
    a.assigned_at,a.picked_up_at,a.delivered_at,a.failed_reason,a.failed_note,
    (SELECT count(*) FROM public.manual_order_driver_assignment_items ai WHERE ai.assignment_id=a.id)
  FROM public.manual_order_driver_assignments a LEFT JOIN public.driver_applications d ON d.user_id=a.driver_user_id
  WHERE a.manual_order_id=p_order_id ORDER BY a.assigned_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_assign_driver_to_manual_order(p_manual_order_id uuid,p_driver_user_id uuid,p_item_ids uuid[])
RETURNS TABLE(assignment_id uuid,cod_due_amount numeric,assigned_item_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_order public.manual_orders%ROWTYPE; v_assignment_id uuid; v_order_subtotal numeric(14,2);
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
  IF v_order.order_status='cancelled' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Cancelled manual orders cannot be assigned.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.driver_applications d WHERE d.user_id=p_driver_user_id AND d.status='approved') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Selected driver is not approved.';
  END IF;
  IF cardinality(p_item_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_item_ids) x) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Duplicate items were selected.';
  END IF;
  IF EXISTS(SELECT 1 FROM unnest(p_item_ids) chosen(item_id)
    LEFT JOIN public.manual_order_items moi ON moi.id=chosen.item_id AND moi.manual_order_id=p_manual_order_id
    LEFT JOIN public.manual_order_driver_assignment_items ai ON ai.manual_order_item_id=moi.id
    LEFT JOIN public.manual_order_driver_assignments a ON a.id=ai.assignment_id
    WHERE moi.id IS NULL OR moi.delivery_readiness_status NOT IN('ready','failed')
      OR (a.id IS NOT NULL AND a.status IN('assigned','picked_up','delivered'))) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Only ready or previously failed items from this order can be assigned.';
  END IF;
  v_order_subtotal:=coalesce(v_order.subtotal,0);
  v_first_assignment:=NOT EXISTS(SELECT 1 FROM public.manual_order_driver_assignments a WHERE a.manual_order_id=p_manual_order_id);
  IF v_order.payment_method IN('cod','cash') THEN
    v_total_due:=greatest(0,v_order.total-v_order.paid_amount);
    v_delivery_due:=CASE WHEN v_first_assignment THEN least(v_order.delivery_fee,v_total_due) ELSE 0 END;
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
    ELSIF v_order.payment_method IN('cod','cash') AND v_order_subtotal>0 THEN
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

REVOKE ALL ON FUNCTION public.admin_update_manual_order_item_fulfillment(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_manual_order_drivers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_manual_order_driver_assignments(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_assign_driver_to_manual_order(uuid,uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_manual_order_item_fulfillment(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_manual_order_drivers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_manual_order_driver_assignments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_driver_to_manual_order(uuid,uuid,uuid[]) TO authenticated;
