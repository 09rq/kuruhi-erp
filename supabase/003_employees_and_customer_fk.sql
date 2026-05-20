-- ① employeesテーブル作成
create table if not exists employees (
  id              uuid primary key default gen_random_uuid(),
  employee_no     text not null unique,
  name            text not null,
  email           text,
  department      text,
  employment_type text,   -- 正社員 / パート / 契約社員 など
  position        text,   -- 役職
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger employees_updated_at
  before update on employees
  for each row execute function update_updated_at();

alter table employees enable row level security;

create policy "authenticated users can manage employees"
  on employees for all
  to authenticated
  using (true)
  with check (true);

create index employees_is_active_idx on employees(is_active);
create index employees_department_idx on employees(department);

-- ② customersテーブルに自社担当者FK・携帯電話カラムを追加
alter table customers
  add column if not exists mobile text,
  add column if not exists assigned_employee_id uuid
    references employees(id) on delete set null;

create index customers_assigned_employee_idx
  on customers(assigned_employee_id);
