-- 材料コード用シーケンス（MAT-0001〜）
create sequence if not exists material_code_seq start 1;

-- 既存データに合わせてシーケンス開始値を調整
do $$
declare
  m_max int;
begin
  select coalesce(
    max(cast(substring(code from 5) as int)), 0
  ) into m_max from materials where code ~ '^MAT-[0-9]+$';

  if m_max > 0 then
    perform setval('material_code_seq', m_max);
  end if;
end;
$$;

-- コード生成関数（アトミック）
create or replace function generate_material_code()
returns text
language plpgsql
security definer
as $$
begin
  return 'MAT-' || lpad(nextval('material_code_seq')::text, 4, '0');
end;
$$;

grant execute on function generate_material_code() to authenticated;
