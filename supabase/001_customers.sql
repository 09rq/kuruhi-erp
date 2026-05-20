-- 顧客・取引先テーブル
create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,           -- 取引先コード (例: C0001, V0001)
  type        text not null                   -- 'customer' | 'vendor_processing' | 'vendor_material'
                check (type in ('customer', 'vendor_processing', 'vendor_material')),
  name        text not null,                  -- 取引先名
  name_kana   text,                           -- フリガナ
  short_name  text,                           -- 略称
  postal_code text,                           -- 郵便番号
  address     text,                           -- 住所
  phone       text,                           -- 電話番号
  fax         text,                           -- FAX番号
  email       text,                           -- メールアドレス
  contact_person text,                        -- 担当者名
  payment_terms  text,                        -- 支払条件（例：月末締め翌月末払い）
  bank_name      text,                        -- 銀行名
  bank_branch    text,                        -- 支店名
  bank_account_type text,                     -- 口座種別（普通/当座）
  bank_account_no   text,                     -- 口座番号
  bank_account_name text,                     -- 口座名義
  note        text,                           -- 備考
  is_active   boolean not null default true,  -- 有効フラグ
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at 自動更新トリガー
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_updated_at
  before update on customers
  for each row execute function update_updated_at();

-- RLS
alter table customers enable row level security;

create policy "authenticated users can manage customers"
  on customers for all
  to authenticated
  using (true)
  with check (true);

-- インデックス
create index customers_type_idx on customers(type);
create index customers_name_idx on customers(name);
create index customers_is_active_idx on customers(is_active);
