-- 商品カテゴリ
create table if not exists product_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table product_categories enable row level security;
create policy "authenticated users can manage product_categories"
  on product_categories for all to authenticated using (true) with check (true);

insert into product_categories (name, sort_order) values
  ('財布',     10),
  ('鞄',       20),
  ('名刺入れ', 30),
  ('キーケース', 40),
  ('ベルト',   50),
  ('小物',     60),
  ('その他',   70)
on conflict (name) do nothing;

-- 商品マスタ
create table if not exists products (
  id                       uuid primary key default gen_random_uuid(),
  product_no               text not null unique,          -- 品番（ユーザー入力）
  name                     text not null,                 -- 品名
  category_id              uuid references product_categories(id) on delete set null,
  client_id                uuid references customers(id) on delete set null,
  client_product_no        text,                          -- クライアント品番
  width_mm                 numeric(8,1),                  -- W mm
  height_mm                numeric(8,1),                  -- H mm
  depth_mm                 numeric(8,1),                  -- D mm
  standard_material_cost   numeric(12,2),                 -- 標準材料費
  standard_processing_cost numeric(12,2),                 -- 標準加工費
  standard_cost            numeric(12,2) generated always as (
    coalesce(standard_material_cost, 0) + coalesce(standard_processing_cost, 0)
  ) stored,                                               -- 標準原価（計算列）
  selling_price            numeric(12,2),                 -- 販売単価
  status                   text not null default 'active'
    check (status in ('active', 'sample', 'discontinued')),
  note                     text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

alter table products enable row level security;
create policy "authenticated users can manage products"
  on products for all to authenticated using (true) with check (true);

create index products_category_idx on products(category_id);
create index products_client_idx   on products(client_id);
create index products_status_idx   on products(status);

-- バリエーション（色・素材・サイズ）
create table if not exists product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sort_order int not null default 0,
  color_name text,
  color_hex  text,
  material   text,
  size_label text,
  status     text not null default 'active'
    check (status in ('active', 'discontinued')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger product_variants_updated_at
  before update on product_variants
  for each row execute function update_updated_at();

alter table product_variants enable row level security;
create policy "authenticated users can manage product_variants"
  on product_variants for all to authenticated using (true) with check (true);

create index product_variants_product_idx on product_variants(product_id);
