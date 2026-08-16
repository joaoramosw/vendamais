-- Vincula produtos legados a organizacoes com base no criador do produto.
-- Execute no SQL Editor do Supabase.

update public.products as products
set organization_id = profiles.active_organization_id
from public.profiles as profiles
where products.organization_id is null
  and products.created_by = profiles.id
  and profiles.active_organization_id is not null;

select
  count(*) as products_without_organization
from public.products
where organization_id is null;
