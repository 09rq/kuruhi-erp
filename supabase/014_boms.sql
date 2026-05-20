-- BOM（部品表）テーブル
create table if not exists boms (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references products(id) on delete cascade,
  product_variant_id uuid references product_variants(id) on delete set null,
  version            integer not null default 1,
  is_active          boolean not null default true,
  notes              text,
  created_by         uuid,   -- auth.users.id
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger boms_updated_at
  before update on boms
  for each row execute function update_updated_at();

alter table boms enable row level security;
create policy "authenticated users can manage boms"
  on boms for all to authenticated using (true) with check (true);

create index boms_product_idx on boms(product_id);

-- BOM 明細テーブル
create table if not exists bom_items (
  id          uuid primary key default gen_random_uuid(),
  bom_id      uuid not null references boms(id) on delete cascade,
  material_id uuid not null references materials(id) on delete restrict,
  category    text,                                   -- 主材料／生地／金具／消耗品
  quantity    numeric(12,3) not null default 0,       -- 使用数量
  unit        text,                                   -- 単位
  yield_rate  numeric(10,4) not null default 1.0,    -- 歩留まり
  width_cm    numeric(8,2),                           -- 横幅 cm（生地のみ）
  net_quantity numeric(12,3) generated always as (
    case
      when category = '生地' and width_cm is not null and width_cm > 0
      then round((quantity / width_cm * yield_rate)::numeric, 3)
      else round((quantity * yield_rate)::numeric, 3)
    end
  ) stored,                                           -- 実値数量（自動計算）
  unit_price  numeric(12,2) not null default 0,       -- 単価
  amount      numeric(12,2) generated always as (
    case
      when category = '生地' and width_cm is not null and width_cm > 0
      then round((quantity / width_cm * yield_rate * unit_price)::numeric, 2)
      else round((quantity * yield_rate * unit_price)::numeric, 2)
    end
  ) stored,                                           -- 金額（自動計算）
  sort_order  integer not null default 0,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger bom_items_updated_at
  before update on bom_items
  for each row execute function update_updated_at();

alter table bom_items enable row level security;
create policy "authenticated users can manage bom_items"
  on bom_items for all to authenticated using (true) with check (true);

create index bom_items_bom_idx      on bom_items(bom_id);
create index bom_items_material_idx on bom_items(material_id);
