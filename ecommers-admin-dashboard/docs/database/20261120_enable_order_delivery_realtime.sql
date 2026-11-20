-- Enable live updates for all tables that drive the admin order and delivery workspace.
-- Existing order, order_items, delivery_batches and driver_assignments publication
-- membership is preserved; only missing tables are added.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'vendor_order_pickups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_order_pickups;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'delivery_batch_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_batch_orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'delivery_batch_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_batch_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'driver_assignment_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_assignment_history;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'driver_delivery_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_delivery_events;
  END IF;
END $$;
