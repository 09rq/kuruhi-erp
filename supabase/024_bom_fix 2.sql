-- BOM修正: amountをGENERATE列からアプリ側計算に変更
-- アプリ側でMath.ceil()を使って切り上げ計算を行うため

ALTER TABLE bom_items DROP COLUMN IF EXISTS amount;
ALTER TABLE bom_items ADD COLUMN amount NUMERIC(12,2) NOT NULL DEFAULT 0;
