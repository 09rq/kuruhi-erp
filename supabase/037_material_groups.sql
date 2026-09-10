-- ─────────────────────────────────────────────────────────────────────────
-- 037_material_groups.sql
-- 「材料グループ」機能。色違いなど、同じ材料の複数バリエーションを
-- 1つのグループにまとめ、単価を一元管理できるようにする。
-- ・グループの単価を変更すると、そのグループに属する材料の単価が自動で連動する
-- ・ただし price_overridden = true の材料は連動の対象外（個別単価を維持）
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists material_groups (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  category       text,
  unit           text,
  standard_price numeric,
  supplier_id    uuid references customers(id),
  note           text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger material_groups_updated_at
  before update on material_groups
  for each row execute function update_updated_at();

alter table material_groups enable row level security;

create policy "authenticated users can manage material_groups"
  on material_groups for all
  to authenticated
  using (true)
  with check (true);

alter table materials
  add column if not exists group_id uuid references material_groups(id) on delete set null;

alter table materials
  add column if not exists price_overridden boolean not null default false;

comment on table material_groups is
  '色違いなど、複数の材料バリエーションをまとめる共通マスター。単価はここで一元管理する。';
comment on column materials.group_id is
  '所属する材料グループ。NULLならグループ化されていない単独の材料。';
comment on column materials.price_overridden is
  'true の場合、所属グループの単価変更が連動せず、この材料独自の単価を維持する。';

create index if not exists materials_group_id_idx on materials(group_id);
