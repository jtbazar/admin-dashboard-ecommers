-- Allow authenticated admins with completed AAL2 verification to change
-- only the order status and updated timestamp on manual orders.
-- Totals, payment, delivery fee, inventory and item rows remain untouched.

GRANT UPDATE (order_status, updated_at)
ON TABLE public.manual_orders
TO authenticated;

DROP POLICY IF EXISTS manual_orders_admin_status_update
ON public.manual_orders;

CREATE POLICY manual_orders_admin_status_update
ON public.manual_orders
FOR UPDATE
TO authenticated
USING (
  (SELECT private.has_role('admin'::public.app_role))
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
)
WITH CHECK (
  (SELECT private.has_role('admin'::public.app_role))
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
);
