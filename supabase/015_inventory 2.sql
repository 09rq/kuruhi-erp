-- ─────────────────────────────────────────────────────────────────────────
-- 015_inventory.sql  在庫管理モジュール
-- ─────────────────────────────────────────────────────────────────────────

-- ─── materials に stock_updated_at を追加 ──────────────────────────────────
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS stock_updated_at TIMESTAMPTZ;

-- ─── products に在庫カラムを追加 ────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS current_stock    INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_updated_at TIMESTAMPTZ;

-- ─── material_stock_transactions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_stock_transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id      UUID        NOT NULL REFERENCES materials(id)  ON DELETE RESTRICT,
  transaction_type TEXT        NOT NULL CHECK (
    transaction_type IN (
      'purchase_in',    -- 発注入庫
      'production_out', -- 製造払出
      'process_return', -- 加工返却
      'inventory_adjust',-- 棚卸調整（quantity は符号付き可）
      'other_in',       -- その他入庫
      'other_out'       -- その他出庫
    )
  ),
  -- inventory_adjust のみ符号付き許可（在庫減少調整に対応）、他は正数必須
  quantity         NUMERIC(12,3) NOT NULL CHECK (
    (transaction_type = 'inventory_adjust') OR (quantity > 0)
  ),
  unit_price       NUMERIC(12,2),
  amount           NUMERIC(12,2),
  reference_type   TEXT         CHECK (reference_type IS NULL
    OR reference_type IN ('purchase_order', 'production_lot')),
  reference_id     UUID,
  note             TEXT,
  transaction_date DATE         NOT NULL,
  created_by       UUID         REFERENCES employees(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TRIGGER material_stock_transactions_updated_at
  BEFORE UPDATE ON material_stock_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE material_stock_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage material_stock_transactions"
  ON material_stock_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX material_stock_transactions_material_idx ON material_stock_transactions(material_id);
CREATE INDEX material_stock_transactions_date_idx     ON material_stock_transactions(transaction_date DESC);
CREATE INDEX material_stock_transactions_type_idx     ON material_stock_transactions(transaction_type);

-- ─── production_lots ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_lots (
  id                 UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number         TEXT     NOT NULL UNIQUE,
  product_id         UUID     NOT NULL REFERENCES products(id)         ON DELETE RESTRICT,
  product_variant_id UUID              REFERENCES product_variants(id) ON DELETE SET NULL,
  planned_quantity   INTEGER  NOT NULL DEFAULT 0,
  completed_quantity INTEGER  NOT NULL DEFAULT 0,
  status             TEXT     NOT NULL DEFAULT 'planned' CHECK (
    status IN ('planned', 'in_progress', 'completed', 'cancelled')
  ),
  started_at         DATE,
  completed_at       DATE,
  notes              TEXT,
  created_by         UUID     REFERENCES employees(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER production_lots_updated_at
  BEFORE UPDATE ON production_lots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE production_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage production_lots"
  ON production_lots FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX production_lots_product_idx ON production_lots(product_id);
CREATE INDEX production_lots_status_idx  ON production_lots(status);
CREATE INDEX production_lots_created_idx ON production_lots(created_at DESC);

-- ─── ロット番号採番関数 ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_lot_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_year TEXT  := to_char(current_date, 'YYYY');
  v_seq  BIGINT;
  v_num  TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(lot_number FROM 10) AS BIGINT)), 0) + 1
    INTO v_seq
    FROM production_lots
   WHERE lot_number LIKE 'LOT-' || v_year || '-%';
  v_num := 'LOT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_num;
END;
$$;

-- ─── production_lot_processes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_lot_processes (
  id                UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id            UUID     NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  sort_order        INTEGER  NOT NULL DEFAULT 0,
  process_name      TEXT     NOT NULL,
  vendor_id         UUID              REFERENCES customers(id) ON DELETE SET NULL,
  planned_quantity  INTEGER  NOT NULL DEFAULT 0,
  unit_price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount            NUMERIC(12,2) GENERATED ALWAYS AS
    (planned_quantity * unit_price) STORED,
  purchase_status   TEXT     NOT NULL DEFAULT 'unpaid'
    CHECK (purchase_status IN ('unpaid', 'paid')),
  purchase_date     DATE,
  purchase_order_id UUID,
  wip_value         NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE WHEN purchase_status = 'paid' THEN planned_quantity * unit_price ELSE 0 END
  ) STORED,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER production_lot_processes_updated_at
  BEFORE UPDATE ON production_lot_processes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE production_lot_processes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage production_lot_processes"
  ON production_lot_processes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX production_lot_processes_lot_idx ON production_lot_processes(lot_id, sort_order);

-- ─── product_stock_transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_stock_transactions (
  id                 UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         UUID     NOT NULL REFERENCES products(id)         ON DELETE RESTRICT,
  product_variant_id UUID              REFERENCES product_variants(id) ON DELETE SET NULL,
  transaction_type   TEXT     NOT NULL CHECK (
    transaction_type IN (
      'production_in',   -- 製造入庫
      'sales_out',       -- 販売出庫
      'return_in',       -- 返品入庫
      'inventory_adjust' -- 棚卸調整（符号付き可）
    )
  ),
  quantity           INTEGER  NOT NULL CHECK (
    (transaction_type = 'inventory_adjust') OR (quantity > 0)
  ),
  unit_cost          NUMERIC(12,2),
  amount             NUMERIC(12,2),
  reference_type     TEXT,
  reference_id       UUID,
  note               TEXT,
  transaction_date   DATE     NOT NULL,
  created_by         UUID     REFERENCES employees(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER product_stock_transactions_updated_at
  BEFORE UPDATE ON product_stock_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE product_stock_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage product_stock_transactions"
  ON product_stock_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX product_stock_transactions_product_idx ON product_stock_transactions(product_id);
CREATE INDEX product_stock_transactions_date_idx    ON product_stock_transactions(transaction_date DESC);
