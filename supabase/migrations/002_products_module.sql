-- ============================================
-- PRODUCTS MODULE MIGRATION
-- ============================================

-- 1. Add role column to profiles (preserving existing 'tipo')
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'admin'
  CHECK (role IN ('admin', 'moderador', 'fornecedor'));

-- Set role based on existing tipo for current records
UPDATE profiles SET role = 'fornecedor' WHERE tipo = 'fornecedor' AND role IS NULL;
UPDATE profiles SET role = 'admin' WHERE tipo = 'empresario' AND (role IS NULL OR role = 'admin');

-- 2. Enable uuid extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  barcode text UNIQUE,
  image_url text,
  category text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- 4. Create product_quotes table (separate from cotacoes)
CREATE TABLE IF NOT EXISTS product_quotes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  company_name text NOT NULL,
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by);
CREATE INDEX IF NOT EXISTS idx_product_quotes_product_id ON product_quotes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_quotes_created_at ON product_quotes(created_at DESC);

-- 6. Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_quotes ENABLE ROW LEVEL SECURITY;

-- 7. Products RLS Policies

-- SELECT: admin and moderador can view all products
CREATE POLICY "products_select_policy" ON products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderador')
    )
  );

-- INSERT: admin and moderador can insert
CREATE POLICY "products_insert_policy" ON products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderador')
    )
  );

-- UPDATE: admin and moderador can update
CREATE POLICY "products_update_policy" ON products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderador')
    )
  );

-- DELETE: only admin can delete
CREATE POLICY "products_delete_policy" ON products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 8. Product Quotes RLS Policies

-- SELECT: admin and moderador
CREATE POLICY "product_quotes_select_policy" ON product_quotes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderador')
    )
  );

-- INSERT: admin and moderador
CREATE POLICY "product_quotes_insert_policy" ON product_quotes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderador')
    )
  );

-- 9. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "products_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

CREATE POLICY "products_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'products'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderador')
    )
  );

CREATE POLICY "products_storage_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'products'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderador')
    )
  );

CREATE POLICY "products_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'products'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
