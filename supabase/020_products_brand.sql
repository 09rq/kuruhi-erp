-- ─────────────────────────────────────────────────────────────────────────
-- 020_products_brand.sql
--
-- ① brand_name / series_name カラム追加
-- ② 品番自動採番関数
-- ③ product_categories データ更新
-- ─────────────────────────────────────────────────────────────────────────

-- ① ブランド名・シリーズ名
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand_name  TEXT,
  ADD COLUMN IF NOT EXISTS series_name TEXT;

COMMENT ON COLUMN products.brand_name  IS 'ブランド名';
COMMENT ON COLUMN products.series_name IS 'シリーズ名';

-- ② 品番自動採番関数（YYMMDD-NNNNN 形式）
CREATE OR REPLACE FUNCTION generate_product_no()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date TEXT;
  v_max  INT;
BEGIN
  v_date := TO_CHAR(NOW() AT TIME ZONE 'Asia/Tokyo', 'YYMMDD');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(product_no, '-', 2) AS INT)), 0)
  INTO   v_max
  FROM   products
  WHERE  product_no ~ ('^' || v_date || '-[0-9]{5}$');
  RETURN v_date || '-' || LPAD(CAST(v_max + 1 AS TEXT), 5, '0');
END;
$$;

-- ③ カテゴリ更新（既存データの category_id を先に NULL クリア）
UPDATE products SET category_id = NULL;
DELETE FROM product_categories;

INSERT INTO product_categories (name, sort_order, is_active) VALUES
  ('長財布',       1, true),
  ('札入れ',       2, true),
  ('名刺入れ',     3, true),
  ('キーケース',   4, true),
  ('カードケース', 5, true),
  ('小銭入れ',     6, true),
  ('鞄',           7, true);
