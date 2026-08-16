-- =====================================================
-- Migração: Módulo de Categorias
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- 1. Tabela principal de categorias
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de junção many-to-many (produto ↔ categoria)
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(product_id, category_id)
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- 4. RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- 5. Policies para categories
CREATE POLICY "categories_select" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (true);
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (true);
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (true);

-- 6. Policies para product_categories
CREATE POLICY "product_categories_select" ON product_categories FOR SELECT USING (true);
CREATE POLICY "product_categories_insert" ON product_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "product_categories_delete" ON product_categories FOR DELETE USING (true);

-- 7. Migração de dados existentes: criar categorias a partir de products.category
INSERT INTO categories (name, slug)
SELECT DISTINCT
  category,
  LOWER(REGEXP_REPLACE(REPLACE(TRIM(category), ' ', '-'), '[^a-z0-9\-]', '', 'g'))
FROM products
WHERE category IS NOT NULL AND TRIM(category) != ''
ON CONFLICT (slug) DO NOTHING;

-- 8. Migração: associar produtos às categorias criadas
INSERT INTO product_categories (product_id, category_id)
SELECT p.id, c.id
FROM products p
JOIN categories c ON c.name = p.category
WHERE p.category IS NOT NULL AND TRIM(p.category) != ''
ON CONFLICT (product_id, category_id) DO NOTHING;
