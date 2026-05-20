-- ─────────────────────────────────────────────────────────────────────────
-- 018_fix_created_by_fk.sql
--
-- 問題: created_by は supabase.auth.getUser() の auth UID を格納するが、
--       各テーブルの FK が employees(id) を指しているため
--       「auth.uid ≠ employees.id」で外部キー制約違反が発生する。
--
-- 修正: created_by の FK を employees(id) → auth.users(id) に付け替える。
--       assigned_to / assigned_employee_id は UI で employees を選ぶので変更不要。
-- ─────────────────────────────────────────────────────────────────────────

-- ─── sales_orders ────────────────────────────────────────────────────────
ALTER TABLE sales_orders
  DROP CONSTRAINT IF EXISTS sales_orders_created_by_fkey;
ALTER TABLE sales_orders
  ADD CONSTRAINT sales_orders_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── production_lots ─────────────────────────────────────────────────────
ALTER TABLE production_lots
  DROP CONSTRAINT IF EXISTS production_lots_created_by_fkey;
ALTER TABLE production_lots
  ADD CONSTRAINT production_lots_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── material_stock_transactions ─────────────────────────────────────────
ALTER TABLE material_stock_transactions
  DROP CONSTRAINT IF EXISTS material_stock_transactions_created_by_fkey;
ALTER TABLE material_stock_transactions
  ADD CONSTRAINT material_stock_transactions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── product_stock_transactions ──────────────────────────────────────────
ALTER TABLE product_stock_transactions
  DROP CONSTRAINT IF EXISTS product_stock_transactions_created_by_fkey;
ALTER TABLE product_stock_transactions
  ADD CONSTRAINT product_stock_transactions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
