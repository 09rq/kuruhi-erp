CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can manage brands"
  ON brands FOR ALL TO authenticated USING (true);
