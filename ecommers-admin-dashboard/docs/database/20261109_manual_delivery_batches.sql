
-- JTBazar admin delivery batches and delivery fee controls.
-- Snapshot of the database migration applied to the shared Supabase project.

alter table public.store_settings add column if not exists free_delivery_enabled boolean not null default false, add column if not exists additional_delivery_fee numeric(12,2) not null default 0;
alter table public.store_settings drop constraint if exists store_settings_additional_delivery_fee_check;
alter table public.store_settings add constraint store_settings_additional_delivery_fee_check check (additional_delivery_fee >= 0);
alter table public.order_items add column if not exists delivery_status text not null default 'pending';
alter table public.order_items drop constraint if exists order_items_delivery_status_check;
alter table public.order_items add constraint order_items_delivery_status_check check (delivery_status in ('pending','ready','delivered'));

create table if not exists public.delivery_batches (
 id uuid primary key default gen_random_uuid(),
 batch_number text not null unique default ('DL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 customer_id uuid references auth.users(id) on delete set null,
 customer_phone text not null,
 status text not null default 'scheduled' check (status in ('scheduled','in_transit','delivered','cancelled')),
 delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
 fee_adjustment_reason text,
 expected_delivery_date date,
 delivery_window_start time,
 delivery_window_end time,
 delivery_note text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint delivery_batches_window_valid check ((expected_delivery_date is null and delivery_window_start is null and delivery_window_end is null) or (expected_delivery_date is not null and delivery_window_start is not null and delivery_window_end is not null and delivery_window_end > delivery_window_start))
);
create table if not exists public.delivery_batch_orders (
 batch_id uuid not null references public.delivery_batches(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete cascade,
 fee_allocated numeric(12,2) not null default 0 check (fee_allocated >= 0),
 created_at timestamptz not null default now(),
 primary key(batch_id,order_id)
);
create index if not exists delivery_batch_orders_order_id_idx on public.delivery_batch_orders(order_id);
create table if not exists public.delivery_batch_items (
 batch_id uuid not null references public.delivery_batches(id) on delete cascade,
 order_item_id uuid not null references public.order_items(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(batch_id,order_item_id),
 unique(order_item_id)
);
alter table public.delivery_batches enable row level security;
alter table public.delivery_batch_orders enable row level security;
alter table public.delivery_batch_items enable row level security;
drop policy if exists "Admins can manage delivery batches" on public.delivery_batches;
create policy "Admins can manage delivery batches" on public.delivery_batches for all to authenticated using ((select private.has_role('admin'::public.app_role))) with check ((select private.has_role('admin'::public.app_role)));
drop policy if exists "Admins can manage delivery batch orders" on public.delivery_batch_orders;
create policy "Admins can manage delivery batch orders" on public.delivery_batch_orders for all to authenticated using ((select private.has_role('admin'::public.app_role))) with check ((select private.has_role('admin'::public.app_role)));
drop policy if exists "Admins can manage delivery batch items" on public.delivery_batch_items;
create policy "Admins can manage delivery batch items" on public.delivery_batch_items for all to authenticated using ((select private.has_role('admin'::public.app_role))) with check ((select private.has_role('admin'::public.app_role)));

CREATE OR REPLACE FUNCTION private.normalize_pk_phone(p_phone text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when pg_catalog.regexp_replace(coalesce(p_phone,''),'[^0-9]','','g') like '92%'
      then '0' || pg_catalog.substr(pg_catalog.regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),3)
    else pg_catalog.regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')
  end
$function$


CREATE OR REPLACE FUNCTION public.admin_confirm_orders_with_delivery_batch(p_order_ids uuid[], p_ready_item_ids uuid[], p_expected_delivery_date date, p_delivery_window_start time without time zone, p_delivery_window_end time without time zone, p_delivery_note text DEFAULT NULL::text, p_delivery_fee_override numeric DEFAULT NULL::numeric, p_fee_adjustment_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_anchor public.orders;v_order public.orders;v_settings public.store_settings;v_batch public.delivery_batches;
  v_batch_id uuid;v_default_fee numeric(12,2);v_fee numeric(12,2);v_id uuid;v_phone text;
  v_count integer;v_existing_count integer;v_existing_batch_id uuid;v_is_first boolean;
begin
  if (auth.jwt()->>'role') is distinct from 'service_role' and (auth.jwt()->>'aal') is distinct from 'aal2' then raise exception using errcode='42501',message='JTBazar authenticator verification is required.'; end if;
  if not private.has_role('admin'::public.app_role) then raise exception using errcode='42501',message='Administrator access required.'; end if;
  if p_order_ids is null or cardinality(p_order_ids)<1 or cardinality(p_order_ids)>20 then raise exception using errcode='22023',message='Select between one and twenty orders.'; end if;
  if p_expected_delivery_date is null or p_delivery_window_start is null or p_delivery_window_end is null or p_delivery_window_end<=p_delivery_window_start then raise exception using errcode='22023',message='A valid delivery date and time window are required.'; end if;
  if (select count(distinct x) from unnest(p_order_ids) x)<>cardinality(p_order_ids) then raise exception using errcode='22023',message='Duplicate orders are not allowed.'; end if;
  select * into v_anchor from public.orders where id=p_order_ids[1] for update;
  if not found or v_anchor.order_status<>'pending'::public.order_status then raise exception using errcode='22023',message='The primary order must still be pending confirmation.'; end if;
  v_phone:=private.normalize_pk_phone(v_anchor.customer_phone);
  select * into v_settings from public.store_settings where id='default';
  v_default_fee:=case when coalesce(v_settings.free_delivery_enabled,false) then 0 else v_settings.delivery_fee end;
  select count(distinct dbo.batch_id),min(dbo.batch_id::text)::uuid into v_existing_count,v_existing_batch_id
  from public.delivery_batch_orders dbo join public.delivery_batches db on db.id=dbo.batch_id
  where dbo.order_id=any(p_order_ids) and db.status='scheduled';
  if v_existing_count>1 then raise exception using errcode='22023',message='Selected orders belong to different active delivery batches. Please select orders from one batch only.'; end if;
  if v_existing_count=1 then
    select * into v_batch from public.delivery_batches where id=v_existing_batch_id for update;
    v_batch_id:=v_existing_batch_id;v_fee:=v_batch.delivery_fee;
    if p_delivery_fee_override is not null and p_delivery_fee_override<>v_fee then raise exception using errcode='22023',message='This customer already has an active delivery batch. Its delivery fee is already set; adjust the existing batch separately.'; end if;
  else
    v_fee:=coalesce(p_delivery_fee_override,v_default_fee);
    if v_fee<0 then raise exception using errcode='22023',message='Delivery fee cannot be negative.'; end if;
    if v_fee<>v_default_fee and nullif(btrim(coalesce(p_fee_adjustment_reason,'')),'') is null then raise exception using errcode='22023',message='A reason is required when changing the standard delivery fee.'; end if;
    insert into public.delivery_batches(customer_id,customer_phone,delivery_fee,fee_adjustment_reason,expected_delivery_date,delivery_window_start,delivery_window_end,delivery_note,created_by)
    values(v_anchor.customer_id,v_anchor.customer_phone,v_fee,nullif(btrim(p_fee_adjustment_reason),''),p_expected_delivery_date,p_delivery_window_start,p_delivery_window_end,nullif(left(btrim(coalesce(p_delivery_note,'')),1000),''),auth.uid()) returning id into v_batch_id;
  end if;
  select count(*) into v_count from public.orders where id=any(p_order_ids) and order_status in ('pending'::public.order_status,'confirmed'::public.order_status,'processing'::public.order_status);
  if v_count<>cardinality(p_order_ids) then raise exception using errcode='22023',message='Every selected order must be active and eligible for delivery.'; end if;
  if exists(select 1 from public.orders o where o.id=any(p_order_ids) and not ((v_anchor.customer_id is not null and o.customer_id=v_anchor.customer_id) or (private.normalize_pk_phone(o.customer_phone)=v_phone and length(v_phone)>=10))) then raise exception using errcode='22023',message='Selected orders must belong to the same customer.'; end if;
  if v_existing_count=1 then update public.delivery_batches set expected_delivery_date=p_expected_delivery_date,delivery_window_start=p_delivery_window_start,delivery_window_end=p_delivery_window_end,delivery_note=nullif(left(btrim(coalesce(p_delivery_note,'')),1000),''),updated_at=now() where id=v_batch_id; end if;
  for v_id in select unnest(p_order_ids) loop
    select * into v_order from public.orders where id=v_id for update;
    if not exists(select 1 from public.delivery_batch_orders where batch_id=v_batch_id and order_id=v_id) then
      v_is_first:=(v_existing_count=0 and v_id=p_order_ids[1]);
      update public.orders set delivery_fee=case when v_is_first then v_fee else 0 end,total=subtotal+case when v_is_first then v_fee else 0 end-discount_amount where id=v_id;
      insert into public.delivery_batch_orders(batch_id,order_id,fee_allocated) values(v_batch_id,v_id,case when v_is_first then v_fee else 0 end);
    end if;
    update public.orders set expected_delivery_date=p_expected_delivery_date,delivery_window_start=p_delivery_window_start,delivery_window_end=p_delivery_window_end,
      delivery_note=nullif(left(btrim(coalesce(p_delivery_note,'')),1000),''),delivery_timing_confirmed_at=now(),delivery_timing_confirmed_by=auth.uid(),
      confirmation_status='confirmed',confirmed_at=case when order_status='pending'::public.order_status then now() else confirmed_at end,
      confirmed_by=case when order_status='pending'::public.order_status then auth.uid() else confirmed_by end,
      confirmation_note='Delivery grouped in batch '||(select batch_number from public.delivery_batches where id=v_batch_id),
      order_status=case when order_status='pending'::public.order_status then 'confirmed'::public.order_status else order_status end,updated_at=now() where id=v_id;
  end loop;
  if coalesce(cardinality(p_ready_item_ids),0)>0 then
    if exists(select 1 from public.order_items oi where oi.id=any(p_ready_item_ids) and (oi.order_id<>all(p_order_ids) or oi.delivery_status<>'pending' or exists(select 1 from public.delivery_batch_items bi where bi.order_item_id=oi.id))) then raise exception using errcode='22023',message='Only pending, unassigned items from the selected orders can be added to this delivery.'; end if;
    insert into public.delivery_batch_items(batch_id,order_item_id) select v_batch_id,oi.id from public.order_items oi where oi.id=any(p_ready_item_ids);
    update public.order_items set delivery_status='ready' where id=any(p_ready_item_ids);
  end if;
  insert into public.admin_audit_logs(actor_id,action,entity,entity_id,details)
  values(auth.uid(),'UPDATE','delivery_batches',v_batch_id,jsonb_build_object('batch_id',v_batch_id,'order_ids',p_order_ids,'ready_item_ids',coalesce(p_ready_item_ids,'{}'::uuid[]),'delivery_fee',v_fee,'default_fee',v_default_fee,'fee_adjustment_reason',p_fee_adjustment_reason,'reused_existing_batch',v_existing_count=1));
  return v_batch_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_create_followup_delivery_batch(p_order_id uuid, p_item_ids uuid[], p_expected_delivery_date date, p_delivery_window_start time without time zone, p_delivery_window_end time without time zone, p_delivery_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_order public.orders;v_batch_id uuid;v_fee numeric(12,2);
begin
  if (auth.jwt()->>'role') is distinct from 'service_role' and (auth.jwt()->>'aal') is distinct from 'aal2' then raise exception using errcode='42501',message='JTBazar authenticator verification is required.'; end if;
  if not private.has_role('admin'::public.app_role) then raise exception using errcode='42501',message='Administrator access required.'; end if;
  if p_item_ids is null or cardinality(p_item_ids)<1 then raise exception using errcode='22023',message='Select at least one pending item.'; end if;
  if p_expected_delivery_date is null or p_delivery_window_start is null or p_delivery_window_end is null or p_delivery_window_end<=p_delivery_window_start then raise exception using errcode='22023',message='A valid delivery date and time window are required.'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.order_status='cancelled'::public.order_status then raise exception using errcode='22023',message='Active order not found.'; end if;
  if exists(select 1 from public.order_items oi where oi.id=any(p_item_ids) and (oi.order_id<>p_order_id or oi.delivery_status='delivered' or exists(select 1 from public.delivery_batch_items bi where bi.order_item_id=oi.id))) then raise exception using errcode='22023',message='Selected items are not eligible for another delivery.'; end if;
  if (select count(*) from public.order_items where id=any(p_item_ids) and order_id=p_order_id)<>cardinality(p_item_ids) then raise exception using errcode='22023',message='One or more selected items were not found.'; end if;
  select additional_delivery_fee into v_fee from public.store_settings where id='default';v_fee:=coalesce(v_fee,0);
  insert into public.delivery_batches(customer_id,customer_phone,delivery_fee,expected_delivery_date,delivery_window_start,delivery_window_end,delivery_note,created_by)
  values(v_order.customer_id,v_order.customer_phone,v_fee,p_expected_delivery_date,p_delivery_window_start,p_delivery_window_end,nullif(left(btrim(coalesce(p_delivery_note,'')),1000),''),auth.uid()) returning id into v_batch_id;
  insert into public.delivery_batch_orders(batch_id,order_id,fee_allocated) values(v_batch_id,p_order_id,v_fee);
  insert into public.delivery_batch_items(batch_id,order_item_id) select v_batch_id,unnest(p_item_ids);
  update public.order_items set delivery_status='ready' where id=any(p_item_ids);
  update public.orders set
    delivery_fee=delivery_fee+v_fee,total=total+v_fee,
    expected_delivery_date=p_expected_delivery_date,delivery_window_start=p_delivery_window_start,delivery_window_end=p_delivery_window_end,
    delivery_note=nullif(left(btrim(coalesce(p_delivery_note,'')),1000),''),delivery_timing_confirmed_at=now(),delivery_timing_confirmed_by=auth.uid(),updated_at=now()
  where id=p_order_id;
  insert into public.admin_audit_logs(actor_id,action,entity,entity_id,details)
  values(auth.uid(),'INSERT','delivery_batches',v_batch_id,jsonb_build_object('order_id',p_order_id,'item_ids',p_item_ids,'additional_delivery_fee',v_fee));
  return v_batch_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_find_customer_delivery_orders(p_order_id uuid)
 RETURNS TABLE(id uuid, order_number text, customer_name text, customer_phone text, subtotal numeric, delivery_fee numeric, total numeric, order_status order_status, created_at timestamp with time zone, expected_delivery_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_order public.orders;
begin
  if (auth.jwt()->>'role') is distinct from 'service_role' and (auth.jwt()->>'aal') is distinct from 'aal2' then raise exception using errcode='42501',message='JTBazar authenticator verification is required.'; end if;
  if not private.has_role('admin'::public.app_role) then raise exception using errcode='42501',message='Administrator access required.'; end if;
  select * into v_order from public.orders where orders.id=p_order_id;
  if not found then raise exception using errcode='22023',message='Order not found.'; end if;
  return query select o.id,o.order_number,o.customer_name,o.customer_phone,o.subtotal,o.delivery_fee,o.total,o.order_status,o.created_at,o.expected_delivery_date
  from public.orders o where o.id<>p_order_id and o.order_status in ('pending'::public.order_status,'confirmed'::public.order_status,'processing'::public.order_status)
    and ((v_order.customer_id is not null and o.customer_id=v_order.customer_id)
      or (private.normalize_pk_phone(o.customer_phone)=private.normalize_pk_phone(v_order.customer_phone) and length(private.normalize_pk_phone(v_order.customer_phone))>=10))
    and not exists(select 1 from public.delivery_batch_orders dbo join public.delivery_batches db on db.id=dbo.batch_id where dbo.order_id=o.id and db.status in ('delivered','cancelled','in_transit'))
  order by o.created_at desc limit 50;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_mark_delivery_batch_delivered(p_batch_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (auth.jwt()->>'role') is distinct from 'service_role' and (auth.jwt()->>'aal') is distinct from 'aal2' then raise exception using errcode='42501',message='JTBazar authenticator verification is required.'; end if;
  if not private.has_role('admin'::public.app_role) then raise exception using errcode='42501',message='Administrator access required.'; end if;
  update public.delivery_batches set status='delivered',updated_at=now() where id=p_batch_id and status<>'cancelled';
  if not found then raise exception using errcode='22023',message='Delivery batch not found or cancelled.'; end if;
  update public.order_items oi set delivery_status='delivered' from public.delivery_batch_items bi where bi.batch_id=p_batch_id and bi.order_item_id=oi.id;
  insert into public.admin_audit_logs(actor_id,action,entity,entity_id,details)
  values(auth.uid(),'UPDATE','delivery_batches',p_batch_id,jsonb_build_object('status','delivered','note','Item delivery recorded; order-level COD collection remains a separate admin action.'));
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_update_store_settings(p_settings jsonb)
 RETURNS store_settings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result_row public.store_settings;
begin
  if (auth.jwt()->>'role') is distinct from 'service_role' and (auth.jwt()->>'aal') is distinct from 'aal2' then
    raise exception using errcode='42501',message='JTBazar authenticator verification is required.';
  end if;
  if not private.has_role('admin'::public.app_role) then
    raise exception using errcode='42501',message='Administrator access is required.';
  end if;
  if p_settings is null or pg_catalog.jsonb_typeof(p_settings)<>'object' then
    raise exception using errcode='22023',message='Store settings must be an object.';
  end if;
  update public.store_settings s set
    store_name=coalesce(nullif(pg_catalog.btrim(p_settings->>'store_name'),''),s.store_name),
    support_email=case when p_settings ? 'support_email' then nullif(pg_catalog.btrim(p_settings->>'support_email'),'') else s.support_email end,
    support_phone=case when p_settings ? 'support_phone' then nullif(pg_catalog.btrim(p_settings->>'support_phone'),'') else s.support_phone end,
    support_whatsapp=case when p_settings ? 'support_whatsapp' then nullif(pg_catalog.btrim(p_settings->>'support_whatsapp'),'') else s.support_whatsapp end,
    delivery_fee=case when p_settings ? 'delivery_fee' then (p_settings->>'delivery_fee')::numeric else s.delivery_fee end,
    free_delivery_enabled=case when p_settings ? 'free_delivery_enabled' then (p_settings->>'free_delivery_enabled')::boolean else s.free_delivery_enabled end,
    additional_delivery_fee=case when p_settings ? 'additional_delivery_fee' then (p_settings->>'additional_delivery_fee')::numeric else s.additional_delivery_fee end,
    cod_enabled=case when p_settings ? 'cod_enabled' then (p_settings->>'cod_enabled')::boolean else s.cod_enabled end,
    return_window_days=case when p_settings ? 'return_window_days' then (p_settings->>'return_window_days')::integer else s.return_window_days end
  where s.id='default' returning * into result_row;
  if not found then raise exception using errcode='22023',message='Store settings were not found.'; end if;
  if result_row.delivery_fee<0 or result_row.additional_delivery_fee<0 or result_row.return_window_days<0 then
    raise exception using errcode='22023',message='Fees and return window must be zero or greater.';
  end if;
  return result_row;
end;
$function$


revoke all on function public.admin_find_customer_delivery_orders(uuid) from public,anon;
revoke all on function public.admin_confirm_orders_with_delivery_batch(uuid[],uuid[],date,time,time,text,numeric,text) from public,anon;
revoke all on function public.admin_create_followup_delivery_batch(uuid,uuid[],date,time,time,text) from public,anon;
revoke all on function public.admin_mark_delivery_batch_delivered(uuid) from public,anon;
grant execute on function public.admin_find_customer_delivery_orders(uuid) to authenticated;
grant execute on function public.admin_confirm_orders_with_delivery_batch(uuid[],uuid[],date,time,time,text,numeric,text) to authenticated;
grant execute on function public.admin_create_followup_delivery_batch(uuid,uuid[],date,time,time,text) to authenticated;
grant execute on function public.admin_mark_delivery_batch_delivered(uuid) to authenticated;
