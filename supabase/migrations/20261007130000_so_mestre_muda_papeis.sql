-- =============================================================================
-- Sete Vidas — só o Admin Mestre muda papéis.
--
-- Aplicar: `npx supabase db push` (com o projeto linkado) ou colar no SQL Editor.
-- Pode rodar de novo sem duplicar nada.
--
-- Antes, um admin comum podia tornar outras contas admin: se uma conta de admin
-- fosse invadida, quem a controlasse poderia promover todo mundo. Agora:
--   admin   painel completo (gatos, fotos, registro), mas não mexe em papéis
--   master  tudo do admin + torna e tira contas de admin
-- O master continua intocável pelo painel (só muda direto no banco).
-- =============================================================================

create or replace function public.admin_set_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text;
begin
  if not public.is_master() then
    raise exception 'Só o Admin Mestre pode mudar papéis.' using errcode = '42501';
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
  update public.profiles set role = new_role where id = target;
end;
$$;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
