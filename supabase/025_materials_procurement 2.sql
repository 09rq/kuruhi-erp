-- 材料テーブル: 調達区分カラムを追加
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS procurement_type TEXT NOT NULL DEFAULT 'buy'
    CHECK (procurement_type IN ('buy', 'supplied'));

-- 単位の選択肢を拡張（ds / cm / mm / g / 組 / その他 を追加）
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_unit_check;
ALTER TABLE materials
  ADD CONSTRAINT materials_unit_check
    CHECK (unit IN ('ds', 'm', 'cm', 'mm', '個', '枚', '本', '組', 'セット', '式', 'kg', 'g', 'その他'));
