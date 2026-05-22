-- ─────────────────────────────────────────────────────────────────────────
-- 035_stocktake.sql  棚卸管理モジュール
-- ─────────────────────────────────────────────────────────────────────────

-- ─── stocktakes（棚卸ヘッダー）─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stocktakes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month   TEXT        NOT NULL UNIQUE, -- 例: '2025-05'
  status       TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'completed')),
  notes        TEXT,
  created_by   UUID        REFERENCES employees(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER stocktakes_updated_at
  BEFORE UPDATE ON stocktakes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE stocktakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage stocktakes"
  ON stocktakes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── stocktake_materials（材料棚卸明細）────────────────────────────────────
CREATE TABLE IF NOT EXISTS stocktake_materials (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_id     UUID        NOT NULL REFERENCES stocktakes(id) ON DELETE CASCADE,
  material_id      UUID        NOT NULL REFERENCES materials(id)  ON DELETE RESTRICT,
  system_quantity  NUMERIC(12,3) NOT NULL DEFAULT 0, -- システム在庫数
  actual_quantity  NUMERIC(12,3),                    -- 実地棚卸数
  unit_price       NUMERIC(12,2) NOT NULL DEFAULT 0, -- 最終仕入単価
  system_amount    NUMERIC(12,2) GENERATED ALWAYS AS (system_quantity * unit_price) STORED,
  actual_amount    NUMERIC(12,2) GENERATED ALWAYS AS (COALESCE(actual_quantity, system_quantity) * unit_price) STORED,
  diff_quantity    NUMERIC(12,3) GENERATED ALWAYS AS (COALESCE(actual_quantity, system_quantity) - system_quantity) STORED,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stocktake_id, material_id)
);

CREATE TRIGGER stocktake_materials_updated_at
  BEFORE UPDATE ON stocktake_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE stocktake_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage stocktake_materials"
  ON stocktake_materials FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX stocktake_materials_stocktake_idx ON stocktake_materials(stocktake_id);

-- ─── stocktake_wip（仕掛棚卸明細）─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stocktake_wip (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_id     UUID        NOT NULL REFERENCES stocktakes(id)       ON DELETE CASCADE,
  lot_id           UUID        NOT NULL REFERENCES production_lots(id)  ON DELETE RESTRICT,
  wip_type         TEXT        NOT NULL CHECK (
    wip_type IN ('internal', 'outsource', 'pre_inspection')
  ),
  -- internal: 社内仕掛 / outsource: 外注仕掛 / pre_inspection: 製品仕掛（検品前）
  quantity         INTEGER     NOT NULL DEFAULT 0,
  unit_cost        NUMERIC(12,2) NOT NULL DEFAULT 0,
  process_cost     NUMERIC(12,2) NOT NULL DEFAULT 0, -- 外注工程費用累計
  total_amount     NUMERIC(12,2) GENERATED ALWAYS AS
    (quantity * (unit_cost + process_cost)) STORED,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stocktake_id, lot_id)
);

CREATE TRIGGER stocktake_wip_updated_at
  BEFORE UPDATE ON stocktake_wip
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE stocktake_wip ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage stocktake_wip"
  ON stocktake_wip FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX stocktake_wip_stocktake_idx ON stocktake_wip(stocktake_id);

-- ─── stocktake_products（製品棚卸明細）────────────────────────────────────
CREATE TABLE IF NOT EXISTS stocktake_products (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_id       UUID        NOT NULL REFERENCES stocktakes(id)          ON DELETE CASCADE,
  product_id         UUID        NOT NULL REFERENCES products(id)             ON DELETE RESTRICT,
  product_variant_id UUID                 REFERENCES product_variants(id)    ON DELETE SET NULL,
  system_quantity    INTEGER     NOT NULL DEFAULT 0,
  actual_quantity    INTEGER,
  unit_cost          NUMERIC(12,2) NOT NULL DEFAULT 0, -- 標準原価
  system_amount      NUMERIC(12,2) GENERATED ALWAYS AS (system_quantity * unit_cost) STORED,
  actual_amount      NUMERIC(12,2) GENERATED ALWAYS AS (COALESCE(actual_quantity, system_quantity) * unit_cost) STORED,
  diff_quantity      INTEGER GENERATED ALWAYS AS (COALESCE(actual_quantity, system_quantity) - system_quantity) STORED,
  note               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stocktake_id, product_id, product_variant_id)
);

CREATE TRIGGER stocktake_products_updated_at
  BEFORE UPDATE ON stocktake_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE stocktake_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage stocktake_products"
  ON stocktake_products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX stocktake_products_stocktake_idx ON stocktake_products(stocktake_id);
