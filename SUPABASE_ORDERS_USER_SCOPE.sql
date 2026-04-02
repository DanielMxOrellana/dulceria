-- Ejecuta este script en Supabase SQL Editor para separar pedidos por usuario autenticado.

alter table public.orders
add column if not exists user_id uuid;

create index if not exists idx_orders_user_id
on public.orders(user_id);

-- Si deseas reforzar la consulta desde Supabase, asegúrate de que las vistas expongan user_id.
drop view if exists public.vw_admin_orders_full;
drop view if exists public.vw_admin_orders_summary;
drop view if exists public.vw_admin_orders_json;

create or replace view public.vw_admin_orders_full as
select
  o.id as order_id,
  o.order_code,
  o.customer_id,
  o.user_id,
  o.customer_cedula,
  o.customer_name,
  o.customer_email,
  o.customer_phone,
  o.customer_address,
  o.customer_city,
  o.customer_reference,
  o.delivery_date,
  o.delivery_time,
  o.delivery_type,
  o.container_type,
  o.container_name,
  o.container_price,
  o.notes,
  o.total,
  o.status,
  o.created_at,
  i.id as item_id,
  i.candy_id,
  i.candy_name,
  i.unit_price,
  i.quantity,
  i.subtotal,
  e.id as extra_id,
  e.extra_name,
  e.unit_price as extra_unit_price,
  e.quantity as extra_quantity,
  e.subtotal as extra_subtotal
from public.orders o
left join public.order_items i on i.order_id = o.id
left join public.order_extras e on e.order_id = o.id;

create or replace view public.vw_admin_orders_summary as
select
  o.id as order_id,
  o.order_code,
  o.customer_id,
  o.user_id,
  o.customer_cedula,
  o.customer_name,
  o.customer_email,
  o.customer_phone,
  o.customer_address,
  o.customer_city,
  o.customer_reference,
  o.delivery_date,
  o.delivery_time,
  o.delivery_type,
  o.container_type,
  o.container_name,
  o.container_price,
  o.notes,
  o.total,
  o.status,
  o.created_at,
  count(distinct i.id) as items_count,
  coalesce(sum(i.quantity), 0) as items_units,
  count(distinct e.id) as extras_count,
  coalesce(sum(e.subtotal), 0) as extras_total
from public.orders o
left join public.order_items i on i.order_id = o.id
left join public.order_extras e on e.order_id = o.id
group by o.id;

create or replace view public.vw_admin_orders_json as
select
  o.id as order_id,
  o.order_code,
  o.customer_id,
  o.user_id,
  o.customer_cedula,
  o.customer_name,
  o.customer_email,
  o.customer_phone,
  o.customer_address,
  o.customer_city,
  o.customer_reference,
  o.delivery_date,
  o.delivery_time,
  o.delivery_type,
  o.container_type,
  o.container_name,
  o.container_price,
  o.notes,
  o.total,
  o.status,
  o.created_at,
  coalesce(
    json_agg(
      distinct jsonb_build_object(
        'item_id', i.id,
        'candy_id', i.candy_id,
        'candy_name', i.candy_name,
        'unit_price', i.unit_price,
        'quantity', i.quantity,
        'subtotal', i.subtotal
      )
    ) filter (where i.id is not null),
    '[]'::json
  ) as items,
  coalesce(
    json_agg(
      distinct jsonb_build_object(
        'extra_id', e.id,
        'name', e.extra_name,
        'unit_price', e.unit_price,
        'quantity', e.quantity,
        'subtotal', e.subtotal
      )
    ) filter (where e.id is not null),
    '[]'::json
  ) as extras
from public.orders o
left join public.order_items i on i.order_id = o.id
left join public.order_extras e on e.order_id = o.id
group by o.id;
