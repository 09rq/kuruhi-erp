-- カテゴリに「小物」「その他」を追加
INSERT INTO product_categories (name, sort_order, is_active)
VALUES
  ('小物',   8, true),
  ('その他', 9, true)
ON CONFLICT DO NOTHING;
