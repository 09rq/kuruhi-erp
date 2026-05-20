-- ─────────────────────────────────────────────────────────────────────────
-- 023_estimates.sql
-- 御見積書テーブル
-- ─────────────────────────────────────────────────────────────────────────

-- ① 見積ヘッダー
CREATE TABLE IF NOT EXISTS estimates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_number  TEXT NOT NULL UNIQUE,
  client_id        UUID REFERENCES customers(id) ON DELETE SET NULL,
  client_contact   TEXT,
  issue_date       DATE NOT NULL,
  expiry_date      DATE,
  subject          TEXT,
  delivery_date    DATE,
  total_amount     NUMERIC(12,2),   -- 税抜小計
  tax_amount       NUMERIC(12,2),   -- 消費税
  grand_total      NUMERIC(12,2),   -- 税込合計
  payment_terms    TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','approved','rejected')),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage estimates"
  ON estimates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX estimates_client_idx  ON estimates(client_id);
CREATE INDEX estimates_status_idx  ON estimates(status);

-- ② 見積明細
CREATE TABLE IF NOT EXISTS estimate_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id  UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  item_name    TEXT NOT NULL,
  quantity     NUMERIC(12,3),
  unit         TEXT,
  unit_price   NUMERIC(12,2),
  amount       NUMERIC(12,2) GENERATED ALWAYS AS (
    COALESCE(quantity, 0) * COALESCE(unit_price, 0)
  ) STORED,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER estimate_items_updated_at
  BEFORE UPDATE ON estimate_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage estimate_items"
  ON estimate_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX estimate_items_estimate_idx ON estimate_items(estimate_id);

-- ③ 自動採番関数（EST-YYYY-NNNNN 形式）
CREATE OR REPLACE FUNCTION generate_estimate_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_max  INT;
BEGIN
  v_year := TO_CHAR(NOW() AT TIME ZONE 'Asia/Tokyo', 'YYYY');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(estimate_number, '-', 3) AS INT)), 0)
  INTO   v_max
  FROM   estimates
  WHERE  estimate_number ~ ('^EST-' || v_year || '-[0-9]{5}$');
  RETURN 'EST-' || v_year || '-' || LPAD(CAST(v_max + 1 AS TEXT), 5, '0');
END;
$$;
