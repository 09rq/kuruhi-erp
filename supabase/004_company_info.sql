-- 自社情報テーブル（シングルトン：常に1行）
create table if not exists company_info (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null default '',
  name_kana           text,
  postal_code         text,
  address             text,
  phone               text,
  fax                 text,
  email               text,
  invoice_number      text
    check (invoice_number is null or invoice_number ~ '^T[0-9]{13}$'),
  bank_name           text,
  bank_branch         text,
  bank_account_type   text,
  bank_account_no     text,
  bank_account_name   text,
  updated_at          timestamptz not null default now()
);

create trigger company_info_updated_at
  before update on company_info
  for each row execute function update_updated_at();

alter table company_info enable row level security;

create policy "authenticated users can manage company_info"
  on company_info for all
  to authenticated
  using (true)
  with check (true);

-- 初期行を1件挿入（upsert用）
insert into company_info (name) values ('') on conflict do nothing;
