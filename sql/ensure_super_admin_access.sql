-- Garanta que o super admin autorizado exista no banco com o papel correto.
-- Execute no SQL Editor do Supabase.

with target_user as (
  select
    id,
    email,
    raw_user_meta_data
  from auth.users
  where lower(email) = lower('devjoaoramos@gmail.com')
)
insert into public.profiles (
  id,
  nome,
  email,
  tipo,
  role,
  global_role
)
select
  target_user.id,
  coalesce(
    target_user.raw_user_meta_data ->> 'nome',
    target_user.raw_user_meta_data ->> 'name',
    split_part(target_user.email, '@', 1)
  ) as nome,
  target_user.email,
  'empresario',
  'admin',
  'super_admin'
from target_user
on conflict (id) do update
set
  nome = excluded.nome,
  email = excluded.email,
  tipo = 'empresario',
  role = 'admin',
  global_role = 'super_admin';

update auth.users
set raw_user_meta_data =
  coalesce(raw_user_meta_data, '{}'::jsonb) ||
  jsonb_build_object(
    'tipo', 'empresario',
    'role', 'admin',
    'global_role', 'super_admin'
  )
where lower(email) = lower('devjoaoramos@gmail.com');

select
  id,
  email,
  tipo,
  role,
  global_role
from public.profiles
where lower(email) = lower('devjoaoramos@gmail.com');
