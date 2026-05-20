-- 販売先用シーケンス（C0001〜）
create sequence if not exists customer_code_seq start 1;

-- 仕入先用シーケンス（V0001〜）
create sequence if not exists vendor_code_seq start 1;

-- 既存データに合わせてシーケンス開始値を調整
do $$
declare
  c_max int;
  v_max int;
begin
  select coalesce(
    max(cast(substring(code from 2) as int)), 0
  ) into c_max from customers where code ~ '^C[0-9]+$';

  select coalesce(
    max(cast(substring(code from 2) as int)), 0
  ) into v_max from customers where code ~ '^V[0-9]+$';

  if c_max > 0 then
    perform setval('customer_code_seq', c_max);
  end if;
  if v_max > 0 then
    perform setval('vendor_code_seq', v_max);
  end if;
end;
$$;

-- コード生成関数（アトミック）
create or replace function generate_customer_code(p_type text)
returns text
language plpgsql
security definer
as $$
declare
  v_next bigint;
begin
  if p_type = 'customer' then
    v_next := nextval('customer_code_seq');
    return 'C' || lpad(v_next::text, 4, '0');
  else
    v_next := nextval('vendor_code_seq');
    return 'V' || lpad(v_next::text, 4, '0');
  end if;
end;
$$;

-- RPC実行権限をauthenticated roleに付与
grant execute on function generate_customer_code(text) to authenticated;
