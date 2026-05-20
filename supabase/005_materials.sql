create table if not exists materials (
  id                  uuid primary key default gen_random_uuid(),

  -- 基本情報
  code                text not null unique,   -- 自動採番 MAT-0001
  name                text not null,
  category            text not null
    check (category in ('革', '生地', '金具', 'ファスナー', '箱', 'その他')),
  spec                text,                   -- 規格
  short_name          text,                   -- 略称
  color_cd            text,                   -- 色CD
  jan_cd              text,                   -- JANCD
  unit                text not null default '個'
    check (unit in ('枚', '本', '個', 'kg', 'm', 'セット', '式')),

  -- 在庫評価単価
  standard_price      numeric(12,2),          -- 標準単価
  month_start_price   numeric(12,2),          -- 月初単価
  month_end_price     numeric(12,2),          -- 月末単価

  -- 取引先情報
  supplier_id         uuid references customers(id) on delete set null,
  order_method        text
    check (order_method is null or order_method in ('個別', '定期', '定量')),
  order_lot           numeric(12,3),          -- 発注ロット
  tax_type            text
    check (tax_type is null or tax_type in ('外税', '内税', '非課税')),
  tax_rate            numeric(5,2),           -- 消費税率（10.00 / 8.00 / 0.00）
  sales_end_date      date,                   -- 販売終了日

  -- 在庫情報
  stock_managed       boolean not null default true,  -- 在庫管理区分
  current_stock       numeric(12,3) not null default 0,
  safety_stock        numeric(12,3),          -- 安全在庫数
  reorder_point       numeric(12,3),          -- 発注点
  note                text,

  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger materials_updated_at
  before update on materials
  for each row execute function update_updated_at();

alter table materials enable row level security;

create policy "authenticated users can manage materials"
  on materials for all
  to authenticated
  using (true)
  with check (true);

create index materials_category_idx  on materials(category);
create index materials_supplier_idx  on materials(supplier_id);
create index materials_is_active_idx on materials(is_active);
