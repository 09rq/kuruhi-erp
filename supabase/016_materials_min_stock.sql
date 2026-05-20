-- ─────────────────────────────────────────────────────────────────────────
-- 016_materials_min_stock.sql  材料マスタに最低在庫数を追加
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS min_stock NUMERIC(12,3);

COMMENT ON COLUMN materials.min_stock IS '最低在庫数（これを下回ったら在庫アラート）';
