-- Simula o mínimo do Supabase (auth, storage e papéis) num Postgres comum,
-- só para os testes. NÃO rode isto num projeto Supabase de verdade.
-- Papéis valem para o servidor inteiro, então só cria se ainda não existem.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid default auth.uid()
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, delete on storage.objects to authenticated;

-- Como no Supabase: privilégios padrão para tabelas e funções novas em public.
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
