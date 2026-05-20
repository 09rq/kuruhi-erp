-- ─────────────────────────────────────────────────────────────────────────
-- 017_sales_orders.sql  受注管理モジュール
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 受注番号シーケンス ──────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS sales_order_seq START 1;

-- ─── 受注番号採番関数 ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN 'SO-' || to_char(now(), 'YYYY') || '-' ||
         LPAD(nextval('sales_order_seq')::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_order_number() TO authenticated;

-- ─── sales_orders（受注ヘッダー）────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_orders (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number             TEXT        NOT NULL UNIQUE,
  client_id                UUID        REFERENCES customers(id)  ON DELETE RESTRICT,
  order_date               DATE        NOT NULL,
  desired_delivery_date    DATE,
  confirmed_delivery_date  DATE,
  status                   TEXT        NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'confirmed', 'in_production', 'delivered', 'invoiced', 'cancelled')
  ),
  assigned_to              UUID        REFERENCES employees(id)  ON DELETE SET NULL,
  notes                    TEXT,
  created_by               UUID        REFERENCES employees(id)  ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER sales_orders_updated_at
  BEFORE UPDATE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage sales_orders"
  ON sales_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX sales_orders_client_idx  ON sales_orders(client_id);
CREATE INDEX sales_orders_status_idx  ON sales_orders(status);
CREATE INDEX sales_orders_date_idx    ON sales_orders(order_date DESC);

-- ─── sales_order_items（受注明細）────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_order_items (
  id                   UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID     NOT NULL REFERENCES sales_orders(id)    ON DELETE CASCADE,
  product_id           UUID              REFERENCES products(id)         ON DELETE RESTRICT,
  product_variant_id   UUID              REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity             INTEGER  NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount               NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  desired_delivery_date DATE,
  production_lot_id    UUID              REFERENCES production_lots(id)  ON DELETE SET NULL,
  notes                TEXT,
  sort_order           INTEGER  NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER sales_order_items_updated_at
  BEFORE UPDATE ON sales_order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage sales_order_items"
  ON sales_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX sales_order_items_order_idx ON sales_order_items(order_id, sort_order);
CREATE INDEX sales_order_items_lot_idx   ON sales_order_items(production_lot_id);

-- ─── production_lots に order_id を追加 ──────────────────────────────────────
ALTER TABLE production_lots
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS production_lots_order_idx ON production_lots(order_id);
