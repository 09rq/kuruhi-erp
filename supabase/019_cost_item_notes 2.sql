-- ─────────────────────────────────────────────────────────────────────────
-- 019_cost_item_notes.sql
--
-- product_cost_items に notes 列を追加。
-- 材料費明細の備考欄として使用する。
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE product_cost_items
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN product_cost_items.notes IS '備考（材料費：自由記入欄）';
