-- =====================================================================
-- Fotos dos check-ins: bucket privado, organizado como
--   checkins/<group_id>/<user_id>/<arquivo>.jpg
-- Membros do grupo veem as fotos; cada pessoa só envia para a própria pasta.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('checkins', 'checkins', false)
on conflict (id) do nothing;

create or replace function public.can_read_photo(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[] := string_to_array(object_name, '/');
begin
  return public.is_member(parts[1]::uuid);
exception when invalid_text_representation then
  return false;
end;
$$;

create or replace function public.can_write_photo(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[] := string_to_array(object_name, '/');
begin
  return array_length(parts, 1) = 3
     and parts[2] = auth.uid()::text
     and public.is_member(parts[1]::uuid);
exception when invalid_text_representation then
  return false;
end;
$$;

create policy "checkins: membros veem as fotos"
  on storage.objects for select to authenticated
  using (bucket_id = 'checkins' and public.can_read_photo(name));

create policy "checkins: cada um envia na propria pasta"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'checkins' and public.can_write_photo(name));

create policy "checkins: cada um apaga as proprias fotos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'checkins' and public.can_write_photo(name));
