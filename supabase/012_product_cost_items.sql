-- productsに原価管理列を追加
alter table products
  add column if not exists cost_mode      text not null default 'estimate'
    check (cost_mode in ('estimate', 'standard')),
  add column if not exists defect_rate    numeric(5,2),          -- 不良率（%）
  add column if not exists cost_confirmed boolean not null default false;  -- 標準原価確定フラグ

-- 原価明細テーブル
create table if not exists product_cost_items (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  cost_type   text not null check (cost_type in ('material', 'outsource', 'labor')),
  cost_mode   text not null check (cost_mode in ('estimate', 'standard')),
  category    text,           -- 材料:区分 / 外注:工程 / 労務:部門
  name        text,           -- 材料:材料名 / 外注:外注先 / 労務:業務内容
  material_id uuid references materials(id) on delete set null,  -- 標準原価モードのみ
  quantity    numeric(12,3) not null default 0,   -- 数量 / 工数
  unit_price  numeric(12,2) not null default 0,   -- 単価 / 時間給
  amount      numeric(12,2) generated always as (quantity * unit_price) stored,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger product_cost_items_updated_at
  before update on product_cost_items
  for each row execute function update_updated_at();

alter table product_cost_items enable row level security;
create policy "authenticated users can manage product_cost_items"
  on product_cost_items for all to authenticated using (true) with check (true);

create index product_cost_items_product_idx on product_cost_items(product_id);
create index product_cost_items_mode_idx    on product_cost_items(product_id, cost_mode);
