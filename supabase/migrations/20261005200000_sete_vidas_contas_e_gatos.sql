-- =============================================================================
-- Sete Vidas — contas, administração, gatos, favoritos e registro de acessos.
--
-- Aplicar: `npx supabase db push` (com o projeto linkado) ou colar no SQL Editor.
-- Pode rodar de novo sem duplicar nada.
--
-- Depois de criar a sua conta no site, torne-se administrador no painel do
-- Supabase (Table Editor → profiles → coluna role = admin) ou com:
--   update public.profiles set role = 'admin' where email = 'seu-email@exemplo.com';
-- A partir daí, novos administradores são promovidos pelo painel do site.
-- =============================================================================


-- ---------- Perfis (um por conta do Supabase Auth) ----------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 60 and name !~ '[<>"`]'),
  email      text not null default '',
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Quem chama é administrador? (security definer: lê profiles sem esbarrar no RLS)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "perfil: ler o próprio; admin lê todos" on public.profiles;
create policy "perfil: ler o próprio; admin lê todos" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "perfil: editar o próprio" on public.profiles;
create policy "perfil: editar o próprio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- A conta só pode mudar o próprio nome. O papel (role) muda só por admin_set_role().
revoke all on public.profiles from anon;
revoke insert, update, delete, truncate on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;


-- ---------- Registro de acessos -----------------------------------------------

create table if not exists public.login_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  user_id    uuid references auth.users (id) on delete set null,
  email      text not null default '',
  event      text not null check (event in ('login', 'falha', 'cadastro', 'saida')),
  ip         text,
  user_agent text
);
create index if not exists login_log_at_idx on public.login_log (at desc);
create index if not exists login_log_email_idx on public.login_log (email, event, at desc);
alter table public.login_log enable row level security;

drop policy if exists "acessos: só admin lê" on public.login_log;
create policy "acessos: só admin lê" on public.login_log
  for select to authenticated using ((select public.is_admin()));

revoke all on public.login_log from anon;
revoke insert, update, delete, truncate on public.login_log from authenticated;
grant select on public.login_log to authenticated;


-- Nova conta → perfil + linha "cadastro" no registro
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id,
          left(btrim(regexp_replace(coalesce(new.raw_user_meta_data ->> 'name', ''), '[<>"`]', '', 'g')), 60),
          coalesce(new.email, ''))
  on conflict (id) do nothing;
  begin
    insert into public.login_log (user_id, email, event) values (new.id, coalesce(new.email, ''), 'cadastro');
  exception when others then null; -- registrar nunca pode impedir o cadastro
  end;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- E-mail trocado no Auth → perfil acompanha
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Cada sessão nova (login) é registrada pelo próprio banco: o site não consegue omitir nem forjar.
create or replace function public.log_session_login()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb := to_jsonb(new); -- ip/user_agent lidos via JSON: não quebra se a coluna mudar de nome
begin
  begin
    insert into public.login_log (user_id, email, event, ip, user_agent)
    select new.user_id, coalesce(u.email, ''), 'login', r ->> 'ip', left(r ->> 'user_agent', 300)
    from auth.users u where u.id = new.user_id;
  exception when others then null; -- registrar nunca pode impedir o login
  end;
  return new;
end;
$$;
revoke execute on function public.log_session_login() from public, anon, authenticated;

do $$
begin
  drop trigger if exists sete_vidas_log_login on auth.sessions;
  create trigger sete_vidas_log_login
    after insert on auth.sessions
    for each row execute function public.log_session_login();
exception when insufficient_privilege then
  raise notice 'Sem permissão para gatilho em auth.sessions: as entradas serão registradas pelo site (log_auth_event).';
end;
$$;

-- Eventos enviados pelo site: tentativa com senha errada, entrada (se o gatilho acima
-- não existir) e saída. Com limites para ninguém lotar o registro.
create or replace function public.log_auth_event(p_event text, p_email text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  hdr   json := nullif(current_setting('request.headers', true), '')::json;
  v_ip  text := nullif(btrim(split_part(coalesce(hdr ->> 'x-forwarded-for', ''), ',', 1)), '');
  v_ua  text := left(coalesce(hdr ->> 'user-agent', ''), 300);
  v_uid uuid := auth.uid();
  v_email text;
begin
  if p_event = 'falha' then
    v_email := lower(left(btrim(coalesce(p_email, '')), 120));
    if v_email !~ '^[^@[:space:]<>"`'']+@[^@[:space:]<>"`'']+\.[^@[:space:]<>"`'']+$' then return; end if;
    if (select count(*) from public.login_log
        where event = 'falha' and email = v_email and at > now() - interval '10 minutes') >= 10 then return; end if;
    if v_ip is not null and (select count(*) from public.login_log
        where event = 'falha' and ip = v_ip and at > now() - interval '10 minutes') >= 30 then return; end if;
    insert into public.login_log (email, event, ip, user_agent) values (v_email, 'falha', v_ip, v_ua);

  elsif p_event in ('login', 'saida') and v_uid is not null then
    -- "login" do site só entra se o gatilho do banco não registrou essa entrada agora há pouco
    if p_event = 'login' and exists (select 1 from public.login_log
        where user_id = v_uid and event = 'login' and at > now() - interval '2 minutes') then return; end if;
    select email into v_email from auth.users where id = v_uid;
    insert into public.login_log (user_id, email, event, ip, user_agent)
    values (v_uid, coalesce(v_email, ''), p_event, v_ip, v_ua);
  end if;
end;
$$;
revoke execute on function public.log_auth_event(text, text) from public;
grant execute on function public.log_auth_event(text, text) to anon, authenticated;

-- Promover / rebaixar contas (só administradores; ninguém tira o próprio acesso)
create or replace function public.admin_set_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem mudar papéis.' using errcode = '42501';
  end if;
  if new_role not in ('user', 'admin') then
    raise exception 'Papel inválido: %', new_role using errcode = '22023';
  end if;
  if target = auth.uid() and new_role <> 'admin' then
    raise exception 'Você não pode remover o seu próprio acesso de administrador.' using errcode = '42501';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;


-- ---------- Gatos --------------------------------------------------------------

create sequence if not exists public.cat_code_seq;

create table if not exists public.cats (
  id         text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 40),
  code       text not null unique default ('SV-' || lpad(nextval('public.cat_code_seq')::text, 3, '0')),
  position   integer,
  -- Textos livres não aceitam < > " ` (viram HTML no site)
  name       text not null check (char_length(btrim(name)) between 1 and 40 and name !~ '[<>"`]'),
  sex        text not null check (sex in ('fêmea', 'macho')),
  age        text not null check (char_length(btrim(age)) between 1 and 20 and age !~ '[<>"`]'),
  age_group  text not null check (age_group in ('filhote', 'adulto', 'idoso')),
  blurb      text not null check (char_length(btrim(blurb)) between 10 and 160 and blurb !~ '[<>"`]'),
  vac        text not null check (char_length(btrim(vac)) between 1 and 40 and vac !~ '[<>"`]'),
  since      date not null check (since >= date '2000-01-01'),
  energy     smallint not null check (energy between 1 and 3),
  traits     text[] not null check (
               cardinality(traits) = 2
               and char_length(btrim(traits[1])) between 2 and 20
               and char_length(btrim(traits[2])) between 2 and 20
               and traits[1] !~ '[<>"`]' and traits[2] !~ '[<>"`]'),
  with_kids  boolean not null,
  with_dogs  boolean not null,
  with_cats  boolean not null,
  fur        text not null check (fur ~ '^#[0-9A-Fa-f]{6}$'),
  eye        text not null check (eye ~ '^#[0-9A-Fa-f]{6}$'),
  stripe     text check (stripe is null or stripe ~ '^#[0-9A-Fa-f]{6}$'),
  pattern    text not null check (pattern in ('liso', 'tigrado', 'frajola', 'tricolor', 'siames')),
  photo      text not null check (photo ~ '^(photos/[a-z0-9-]+|https://[^[:space:]]+)$' and char_length(photo) <= 300),
  focus      text not null default '50% 50%' check (focus ~ '^(100|[0-9]{1,2})% (100|[0-9]{1,2})%$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cats_stripe_tigrado check (pattern <> 'tigrado' or stripe is not null)
);
alter sequence public.cat_code_seq owned by public.cats.code;
create index if not exists cats_position_idx on public.cats (position);
alter table public.cats enable row level security;

-- Data de chegada não pode ser no futuro; novos gatos vão para o fim da lista
create or replace function public.cats_before_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.since > current_date then
    raise exception 'A data de chegada não pode ser no futuro.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and new.position is null then
    select coalesce(max(position), 0) + 1 into new.position from public.cats;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists cats_before_write on public.cats;
create trigger cats_before_write
  before insert or update on public.cats
  for each row execute function public.cats_before_write();

drop policy if exists "gatos: todos leem" on public.cats;
create policy "gatos: todos leem" on public.cats for select to anon, authenticated using (true);
drop policy if exists "gatos: admin cadastra" on public.cats;
create policy "gatos: admin cadastra" on public.cats for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "gatos: admin edita" on public.cats;
create policy "gatos: admin edita" on public.cats for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "gatos: admin remove" on public.cats;
create policy "gatos: admin remove" on public.cats for delete to authenticated using ((select public.is_admin()));

revoke insert, update, delete, truncate on public.cats from anon;
revoke truncate on public.cats from authenticated;
grant select on public.cats to anon, authenticated;
grant usage on sequence public.cat_code_seq to authenticated;

-- Os 8 gatos que já estavam no site
insert into public.cats (id, code, position, name, sex, age, age_group, blurb, vac, since,
                         energy, traits, with_kids, with_dogs, with_cats, fur, eye, stripe, pattern, photo, focus)
values
  ('tangerina', 'SV-001', 1, 'Tangerina', 'fêmea', '4 meses', 'filhote', 'Sobe em tudo e depois não sabe descer. Adora varinha com pena.', 'V4 · 1ª dose', '2026-08-10'::date, 3, array['brincalhona', 'curiosa'], true, false, true, '#E8913A', '#8DBA4E', '#B8621A', 'tigrado', 'photos/tangerina', '55% 40%'),
  ('nanquim', 'SV-002', 2, 'Nanquim', 'macho', '3 anos', 'adulto', 'Tímido nos primeiros dias, depois dorme no seu travesseiro.', 'V4 em dia', '2026-03-02'::date, 2, array['tímido', 'carinhoso'], false, false, true, '#26222E', '#E7B53B', null, 'liso', 'photos/nanquim', '66% 40%'),
  ('neblina', 'SV-003', 3, 'Dona Neblina', 'fêmea', '11 anos', 'idoso', 'Ronrona alto, pede colo e quer um sofá tranquilo só para ela.', 'V4 em dia', '2025-11-18'::date, 1, array['carinhosa', 'calma'], false, false, false, '#9A9AA8', '#D9A441', '#777786', 'tigrado', 'photos/neblina', '55% 35%'),
  ('bigode', 'SV-004', 4, 'Bigode', 'macho', '2 anos', 'adulto', 'Conversador. Recebe visita na porta e come de tudo.', 'V4 em dia', '2026-06-05'::date, 2, array['sociável', 'falante'], true, true, true, '#2B2733', '#9CC45B', null, 'frajola', 'photos/bigode', '50% 30%'),
  ('pacoca', 'SV-005', 5, 'Paçoca', 'fêmea', '5 meses', 'filhote', 'Curiosa, quer saber o que tem dentro de toda sacola.', 'V4 · 2ª dose', '2026-07-22'::date, 3, array['curiosa', 'brincalhona'], true, false, true, '#2E2926', '#E2A73C', null, 'tricolor', 'photos/pacoca', '66% 50%'),
  ('cha', 'SV-006', 6, 'Chá', 'macho', '7 anos', 'adulto', 'Calmo e grudado: segue a pessoa de cômodo em cômodo.', 'V4 em dia', '2026-01-15'::date, 1, array['calmo', 'carinhoso'], false, true, true, '#EADFCB', '#6FA6E0', null, 'siames', 'photos/cha', '30% 35%'),
  ('pipoca', 'SV-007', 7, 'Pipoca', 'macho', '3 meses', 'filhote', 'O menor da ninhada e o mais barulhento na hora da ração.', 'V4 · 1ª dose', '2026-09-01'::date, 3, array['brincalhão', 'falante'], true, false, true, '#F5F3EF', '#6FB3E8', null, 'liso', 'photos/pipoca', '40% 35%'),
  ('lindolfo', 'SV-008', 8, 'Seu Lindolfo', 'macho', '13 anos', 'idoso', 'Dorme 18 horas por dia. Nas outras 6, quer carinho no queixo.', 'V4 em dia', '2025-09-30'::date, 1, array['calmo', 'carinhoso'], false, false, true, '#D9853A', '#B9C24A', '#AD5E1E', 'tigrado', 'photos/lindolfo', '50% 35%')
on conflict (id) do nothing;

-- Próximo código depois do maior já usado (SV-009 em diante)
select setval('public.cat_code_seq',
              greatest(coalesce((select max(substring(code from 4)::int) from public.cats where code ~ '^SV-[0-9]+$'), 0), 1));


-- ---------- Favoritos -----------------------------------------------------------

create table if not exists public.favorites (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cat_id     text not null references public.cats (id) on delete cascade on update cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, cat_id)
);
alter table public.favorites enable row level security;

drop policy if exists "favoritos: ler os próprios" on public.favorites;
create policy "favoritos: ler os próprios" on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "favoritos: salvar os próprios" on public.favorites;
create policy "favoritos: salvar os próprios" on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "favoritos: tirar os próprios" on public.favorites;
create policy "favoritos: tirar os próprios" on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.favorites from anon;
revoke update, truncate on public.favorites from authenticated;
grant select, insert, delete on public.favorites to authenticated;


-- ---------- Fotos (Storage) -------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cat-photos', 'cat-photos', true, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública vem do bucket público; enviar, listar e apagar só admin
drop policy if exists "fotos: admin lista" on storage.objects;
create policy "fotos: admin lista" on storage.objects
  for select to authenticated using (bucket_id = 'cat-photos' and (select public.is_admin()));
drop policy if exists "fotos: admin envia" on storage.objects;
create policy "fotos: admin envia" on storage.objects
  for insert to authenticated with check (bucket_id = 'cat-photos' and (select public.is_admin()));
drop policy if exists "fotos: admin apaga" on storage.objects;
create policy "fotos: admin apaga" on storage.objects
  for delete to authenticated using (bucket_id = 'cat-photos' and (select public.is_admin()));
