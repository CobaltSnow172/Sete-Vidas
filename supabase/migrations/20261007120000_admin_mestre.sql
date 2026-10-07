-- =============================================================================
-- Sete Vidas — Admin Mestre (role = 'master').
--
-- Aplicar: `npx supabase db push` (com o projeto linkado) ou colar no SQL Editor.
-- Pode rodar de novo sem duplicar nada.
--
-- Papéis:
--   user    conta comum
--   admin   painel completo; pode tornar outras contas admin,
--           mas não pode tirar o acesso de outro administrador
--   master  tudo do admin + pode tirar o acesso de administradores.
--           Ninguém muda um master pelo site: só direto no banco, com
--             update public.profiles set role = 'admin' where email = '...';
-- =============================================================================

alter table public.profiles drop constraint if exists profiles_role_check;
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

-- Busca no painel por nome ou e-mail
create extension if not exists pg_trgm with schema extensions;
create index if not exists profiles_name_trgm_idx on public.profiles using gin (name extensions.gin_trgm_ops);
create index if not exists profiles_email_trgm_idx on public.profiles using gin (email extensions.gin_trgm_ops);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists login_log_user_at_idx on public.login_log (user_id, at desc) where event = 'login';

-- Arthur (conta do GitHub CobaltSnow172) é o Admin Mestre
update public.profiles set role = 'master' where id = 'c4cc61c4-1ebe-4820-b242-a5c7d934f7b6';
