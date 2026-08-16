-- =============================================================================
-- Seed: catálogo inicial de produtos de supermercado/mercado de bairro
--
-- Lista curada manualmente (não é scraping/API externa) com produtos comuns
-- de supermercado brasileiro + marcas conhecidas na Bahia. AVISO: não tenho
-- conhecimento profundo e verificado de marcas hiperlocais de bairro em
-- Salvador — esta lista cobre principalmente marcas nacionais/regionais
-- amplamente conhecidas. Revise e complete com marcas específicas que você
-- conhece do seu mercado antes de considerar isso definitivo.
--
-- organization_id fica NULL de propósito — os 5 produtos já cadastrados hoje
-- também estão com organization_id NULL, e o admin atual não tem
-- active_organization_id definido, então produtos com organization_id NULL
-- são os que aparecem por padrão (ver applyOrganizationScope em products.ts).
-- Se isso mudar, ajuste manualmente antes de rodar.
--
-- created_by aponta pro único admin confirmado nesta sessão
-- (devjoaoramos@gmail.com) — troque se for outro usuário.
-- =============================================================================

INSERT INTO products (name, category, price_unit_store, organization_id, created_by) VALUES
  -- Alimentos
  ('Arroz Branco Tipo 1 5kg', 'alimentos', 24.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Arroz Camil Tipo 1 5kg', 'alimentos', 26.50, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Feijão Carioca Camil 1kg', 'alimentos', 8.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Feijão Preto Kicaldo 1kg', 'alimentos', 8.50, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Açúcar Cristal União 1kg', 'alimentos', 5.20, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Açúcar Refinado Caravelas 1kg', 'alimentos', 5.50, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Óleo de Soja Soya 900ml', 'alimentos', 7.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Óleo de Soja Liza 900ml', 'alimentos', 7.70, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Café Torrado e Moído Pilão 500g', 'alimentos', 14.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Café Torrado e Moído 3 Corações 500g', 'alimentos', 13.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Farinha de Trigo Dona Benta 1kg', 'alimentos', 6.50, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Farinha de Mandioca 1kg', 'alimentos', 7.00, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Macarrão Espaguete Renata 500g', 'alimentos', 5.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Molho de Tomate Fugini 340g', 'alimentos', 3.50, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Leite Condensado Moça 395g', 'alimentos', 7.20, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Leite Integral Itambé 1L', 'alimentos', 6.30, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Biscoito Cream Cracker Adria 400g', 'alimentos', 6.80, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Sal Refinado Cisne 1kg', 'alimentos', 2.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Dendê (Azeite de Dendê) 500ml', 'alimentos', 12.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Coco Ralado Sococo 100g', 'alimentos', 4.50, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),

  -- Limpeza
  ('Detergente Líquido Ypê 500ml', 'limpeza', 2.50, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Sabão em Pó OMO 1kg', 'limpeza', 15.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Sabão em Pó Minuano 1kg', 'limpeza', 12.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Água Sanitária Ypê 1L', 'limpeza', 5.50, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Desinfetante Pinho Sol 500ml', 'limpeza', 8.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Amaciante Comfort 1L', 'limpeza', 9.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Esponja de Aço Bombril', 'limpeza', 4.20, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Álcool Etílico 70% 1L', 'limpeza', 8.50, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),

  -- Higiene
  ('Sabonete Ypê Lavanda', 'higiene', 2.20, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Sabonete Líquido Pampers 200ml', 'higiene', 9.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Shampoo Pantene 400ml', 'higiene', 18.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Creme Dental Colgate 90g', 'higiene', 5.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Papel Higiênico Neve 12 rolos', 'higiene', 22.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Absorvente Sempre Livre', 'higiene', 8.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Desodorante Nivea Roll-On', 'higiene', 11.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9'),
  ('Loção Hidratante Nivea Milk 200ml', 'higiene', 15.90, NULL, '143186da-0553-4342-a54d-95f7112acaf9');

-- Sem ON CONFLICT: products.name não tem constraint único, então rodar este
-- script duas vezes duplica as linhas. Rode uma vez só, ou confira antes
-- (SELECT name FROM products WHERE name IN (...)) se já rodou.
