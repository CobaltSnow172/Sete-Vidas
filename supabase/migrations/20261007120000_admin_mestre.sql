-- =============================================================================
-- Sete Vidas — Admin Mestre (role = 'master').
--
-- Aplicar: `npx supabase db push` (com o projeto linkado) ou colar no SQL Editor.
-- Pode rodar de novo sem duplicar nada.
--
-- Papéis:
--   user    conta comum
--   admin   painel completo
--   master  tudo do admin + torna e tira contas de admin
--           (até 20261007130000, admin comum também podia promover)
--           Ninguém muda um master pelo site: só direto no banco, com
--             update public.profiles set role = 'admin' where email = '...';
-- =============================================================================

-- Troca a regra antiga de papéis (só user/admin), seja qual for o nome dela
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end;
$$;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin', 'master'));

-- Admin Mestre também é administrador: todas as regras que usam is_admin() valem para ele
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin', 'master'));
$$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.is_master()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'master');
$$;
revoke execute on function public.is_master() from public;
grant execute on function public.is_master() to anon, authenticated;

-- Promover / rebaixar contas pelo painel
create or replace function public.admin_set_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem mudar papéis.' using errcode = '42501';
  end if;
  if new_role not in ('user', 'admin') then
    raise exception 'Papel inválido: %', new_role using errcode = '22023';
  end if;
  if target = auth.uid() then
    raise exception 'Você não pode mudar o seu próprio papel.' using errcode = '42501';
  end if;
  select role into v_role from public.profiles where id = target;
  if v_role is null then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;
  if v_role = 'master' then
    raise exception 'O Admin Mestre não pode ser alterado pelo painel.' using errcode = '42501';
  end if;
  if v_role = 'admin' and new_role = 'user' and not public.is_master() then
    raise exception 'Só o Admin Mestre pode remover o acesso de outro administrador.' using errcode = '42501';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- Ordem da lista de usuários e último acesso no painel
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists login_log_user_at_idx on public.login_log (user_id, at desc) where event = 'login';

-- Arthur é o Admin Mestre (pelo e-mail: o ID muda se a conta for apagada e criada de novo)
update public.profiles set role = 'master' where lower(email) = 'arthurbr120@hotmail.com';
