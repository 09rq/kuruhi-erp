-- product_cost_items: amount を生成列から通常列に変更し、新カラムを追加
-- ※ PostgreSQL では generated 列は DROP して再追加する
alter table product_cost_items drop column if exists amount;

alter table product_cost_items
  add column amount     numeric(12,2) not null default 0,
  add column supplier   text,
  add column yield_rate numeric(10,4),   -- 歩留（主材料・生地）
  add column width_cm   numeric(8,2);    -- 横幅 cm（生地のみ）

-- products: 発送費・雑費を追加
alter table products
  add column if not exists shipping_cost numeric(12,2),
  add column if not exists misc_cost     numeric(12,2);
