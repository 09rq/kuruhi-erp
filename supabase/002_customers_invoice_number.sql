-- customersテーブルにインボイス登録番号カラムを追加
alter table customers
  add column if not exists invoice_number text
    check (invoice_number is null or invoice_number ~ '^T[0-9]{13}$');
