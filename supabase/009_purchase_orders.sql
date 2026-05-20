-- 発注書ヘッダー
create table if not exists purchase_orders (
  id                      uuid primary key default gen_random_uuid(),
  po_number               text not null unique,   -- PO-2026-0001
  status                  text not null default 'draft'
    check (status in ('draft','ordered','awaiting_delivery','delivered','cancelled')),
  order_date              date not null,
  desired_delivery_date   date,
  supplier_id             uuid references customers(id) on delete restrict,
  supplier_name           text not null,          -- 発注時スナップショット
  supplier_phone          text,
  supplier_fax            text,
  supplier_contact        text,
  assigned_employee_id    uuid references employees(id) on delete set null,
  subtotal                numeric(12,2) not null default 0,
  note                    text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- 発注書明細
create table if not exists purchase_order_items (
  id                  uuid primary key default gen_random_uuid(),
  purchase_order_id   uuid not null references purchase_orders(id) on delete cascade,
  sort_order          int not null default 0,
  material_id         uuid references materials(id) on delete set null,
  item_name           text not null,
  model_name          text,
  color               text,
  quantity            numeric(12,3) not null default 1,
  unit                text,
  unit_price          numeric(12,2) not null default 0,
  amount              numeric(12,2) not null default 0,
  delivery_date       date,
  created_at          timestamptz not null default now()
);

create trigger purchase_orders_updated_at
  before update on purchase_orders
  for each row execute function update_updated_at();

alter table purchase_orders      enable row level security;
alter table purchase_order_items enable row level security;

create policy "authenticated users can manage purchase_orders"
  on purchase_orders for all to authenticated using (true) with check (true);
create policy "authenticated users can manage purchase_order_items"
  on purchase_order_items for all to authenticated using (true) with check (true);

create index po_status_idx      on purchase_orders(status);
create index po_supplier_idx    on purchase_orders(supplier_id);
create index poi_order_idx      on purchase_order_items(purchase_order_id);

-- 発注番号シーケンス（年度ごとに採番）
create sequence if not exists purchase_order_seq start 1;

create or replace function generate_po_number()
returns text
language plpgsql security definer as $$
begin
  return 'PO-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('purchase_order_seq')::text, 4, '0');
end;
$$;

grant execute on function generate_po_number() to authenticated;
