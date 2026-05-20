-- materials テーブルに在庫・棚卸設定カラムを追加
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS inventory_category boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS storage_location   text,
  ADD COLUMN IF NOT EXISTS shelf_number       text,
  ADD COLUMN IF NOT EXISTS lot_management     boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN materials.inventory_category IS '棚卸区分: true=定期棚卸対象';
COMMENT ON COLUMN materials.storage_location   IS '保管場所';
COMMENT ON COLUMN materials.shelf_number       IS '棚番号';
COMMENT ON COLUMN materials.lot_management     IS 'ロット管理: true=ロットごとに単価管理する';
