-- ─────────────────────────────────────────────────────────────────────────
-- 036_purchase_order_received_quantity.sql
-- 発注明細に「実納品数量」を追加。
-- 革などの実測材料は発注数量と納品数量がぴったり一致しないことが多いため、
-- 「納品済にする」操作時に実際に届いた数量を入力できるようにする。
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS received_quantity NUMERIC;

COMMENT ON COLUMN purchase_order_items.received_quantity IS
  '実際に納品された数量。未入力（納品前）は NULL。在庫加算にはこの値を優先して使用する。';
