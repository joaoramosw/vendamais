#!/usr/bin/env node
/*
 * Popula `products` com 300 produtos reais de cosméticos e bem-estar, sem
 * imagem (image_url = null) — massa de teste para paginação, busca e filtros.
 *
 * Uso:
 *   node scripts/seed-produtos-cosmeticos.mjs            # insere
 *   node scripts/seed-produtos-cosmeticos.mjs --dry-run  # só mostra o plano
 *   node scripts/seed-produtos-cosmeticos.mjs --undo     # remove o que este
 *                                                        # script inseriu
 *
 * Idempotente: produto já existente (mesmo nome, não excluído) é pulado, então
 * rodar duas vezes não duplica. Escreve com a service role key porque a RLS de
 * `products` depende da tabela `profiles` legada (ver CLAUDE.md, gotcha #21).
 */
import fs from "node:fs";
import path from "node:path";

// ─── Catálogo ────────────────────────────────────────────────────────────────
// [nome, fabricante, preço unitário de loja]
const CATALOGO = [
  {
    categoria: "Cabelos",
    cor: "#a855f7",
    itens: [
      ["Shampoo Pantene Hidro-Cauterização 400ml", "Pantene", 26.9],
      ["Condicionador Pantene Restauração Profunda 400ml", "Pantene", 26.9],
      ["Máscara Pantene Hidro-Cauterização 300g", "Pantene", 29.9],
      ["Shampoo Elseve Hidra Hialurônico 400ml", "L'Oréal Paris", 24.9],
      ["Condicionador Elseve Reparação Total 5 400ml", "L'Oréal Paris", 24.9],
      ["Óleo Elseve Óleo Extraordinário 100ml", "L'Oréal Paris", 34.9],
      ["Shampoo Seda Boom Liso 325ml", "Seda", 12.9],
      ["Condicionador Seda Ceramidas Reconstrução 325ml", "Seda", 12.9],
      ["Creme de Pentear Seda Cachos Definidos 300ml", "Seda", 14.9],
      ["Shampoo Dove Óleo Nutrição 400ml", "Dove", 22.9],
      ["Condicionador Dove Reconstrução Completa 400ml", "Dove", 22.9],
      ["Máscara Dove Ritual de Reparação 350g", "Dove", 27.9],
      ["Shampoo TRESemmé Blindagem Antiporosidade 400ml", "TRESemmé", 23.9],
      ["Condicionador TRESemmé Detox Capilar 400ml", "TRESemmé", 23.9],
      ["Shampoo Clear Anticaspa Ice Cool Menthol 400ml", "Clear", 27.9],
      ["Shampoo Head & Shoulders Limpeza Renovadora 400ml", "Head & Shoulders", 29.9],
      ["Shampoo Head & Shoulders Anticaspa 2 em 1 400ml", "Head & Shoulders", 31.9],
      ["Shampoo Johnson's Baby Cabelos Claros 400ml", "Johnson's", 21.9],
      ["Condicionador Johnson's Baby Cabelos Cacheados 400ml", "Johnson's", 21.9],
      ["Shampoo Palmolive Naturals Óleo de Argan 350ml", "Palmolive", 11.9],
      ["Condicionador Palmolive Naturals Nutrição Radiante 350ml", "Palmolive", 11.9],
      ["Creme de Pentear Salon Line #TodeCacho Ativados 1kg", "Salon Line", 32.9],
      ["Máscara Salon Line SOS Bomba Original 300g", "Salon Line", 19.9],
      ["Leave-in Salon Line Meu Liso Ultra 140ml", "Salon Line", 16.9],
      ["Água Oxigenada Cremosa Salon Line 20 Volumes 900ml", "Salon Line", 12.9],
      ["Creme de Tratamento Novex Meus Cachos 400g", "Novex", 18.9],
      ["Máscara Skala Bomba de Vitaminas 1kg", "Skala", 24.9],
      ["Máscara Skala Ceramidas 1kg", "Skala", 24.9],
      ["Creme de Pentear Lola Cosmetics Meu Cacho Minha Vida 230g", "Lola Cosmetics", 39.9],
      ["Máscara Inoar Argan Oil 250g", "Inoar", 42.9],
      ["Máscara Widi Care Juba Nutritiva 500g", "Widi Care", 44.9],
      ["Creme Widi Care Encaracolando a Juba 500g", "Widi Care", 46.9],
      ["Protetor Térmico Truss Net Fluid 250ml", "Truss", 89.9],
      ["Shampoo Truss Miracle 300ml", "Truss", 79.9],
      ["Shampoo Kérastase Nutritive Bain Satin 250ml", "Kérastase", 159.9],
      ["Máscara L'Oréal Professionnel Absolut Repair 250g", "L'Oréal Professionnel", 129.9],
      ["Shampoo Redken All Soft 300ml", "Redken", 139.9],
      ["Shampoo Wella Fusion Intense Repair 250ml", "Wella Professionals", 99.9],
      ["Máscara Cadiveu Plástica dos Fios 200g", "Cadiveu", 69.9],
      ["Ativador de Cachos Yenzah Cachos Poderosos 250ml", "Yenzah", 29.9],
      ["Máscara Aussie Cachos Definidos 3 Minutos 236ml", "Aussie", 44.9],
      ["Shampoo Herbal Essences Bio:Renew Aloe 400ml", "Herbal Essences", 34.9],
      ["Creme de Tratamento Monange Hidratação Intensiva 300g", "Monange", 14.9],
      ["Shampoo Bio Extratus Jaborandi 250ml", "Bio Extratus", 29.9],
      ["Máscara Bio Extratus Nutriforce 250g", "Bio Extratus", 32.9],
    ],
  },
  {
    categoria: "Pele e Rosto",
    cor: "#ec4899",
    itens: [
      ["Gel de Limpeza Facial Neutrogena Deep Clean 80g", "Neutrogena", 26.9],
      ["Hidratante Facial Neutrogena Hydro Boost Water Gel 50g", "Neutrogena", 79.9],
      ["Demaquilante Neutrogena Deep Clean Bifásico 117ml", "Neutrogena", 34.9],
      ["Gel de Limpeza La Roche-Posay Effaclar 300ml", "La Roche-Posay", 99.9],
      ["Creme La Roche-Posay Effaclar Duo(+) 40g", "La Roche-Posay", 129.9],
      ["Sérum La Roche-Posay Hyalu B5 30ml", "La Roche-Posay", 219.9],
      ["Sérum Vichy Minéral 89 30ml", "Vichy", 169.9],
      ["Creme Vichy Normaderm Phytosolution 50ml", "Vichy", 139.9],
      ["Hidratante Facial Vichy Aqualia Thermal 50ml", "Vichy", 129.9],
      ["Loção de Limpeza Cetaphil 473ml", "Cetaphil", 109.9],
      ["Hidratante Facial Cetaphil FPS 15 118ml", "Cetaphil", 89.9],
      ["Gel de Limpeza CeraVe Pele Oleosa 236ml", "CeraVe", 69.9],
      ["Loção Hidratante Facial CeraVe FPS 30 52ml", "CeraVe", 79.9],
      ["Gel de Limpeza Eucerin Dermopure 400ml", "Eucerin", 89.9],
      ["Sérum Principia AC02 Ácido Salicílico 30ml", "Principia", 59.9],
      ["Sérum Principia RET0.3 Retinol 30ml", "Principia", 69.9],
      ["Sérum Principia HA1 Ácido Hialurônico 30ml", "Principia", 59.9],
      ["Sérum Creamy Vitamina C 10% 30ml", "Creamy", 79.9],
      ["Gel de Limpeza Facial Creamy 150ml", "Creamy", 49.9],
      ["Sérum Adcos Antioxidante Vitamina C 30ml", "Adcos", 149.9],
      ["Água Micelar Garnier Skin Active 400ml", "Garnier", 34.9],
      ["Sérum Garnier Uniform & Matte Vitamina C 30ml", "Garnier", 54.9],
      ["Sérum L'Oréal Revitalift Hialurônico 30ml", "L'Oréal Paris", 79.9],
      ["Creme L'Oréal Revitalift Cicacreme 50g", "L'Oréal Paris", 69.9],
      ["Esfoliante Facial L'Oréal Pure Clay Detox 50g", "L'Oréal Paris", 29.9],
      ["Máscara Facial L'Oréal Pure Clay Purifica 50g", "L'Oréal Paris", 29.9],
      ["Água Micelar Nivea 5 em 1 200ml", "Nivea", 24.9],
      ["Creme Hidratante Facial Nivea Soft 100ml", "Nivea", 22.9],
      ["Creme para Área dos Olhos Nivea Q10 15ml", "Nivea", 39.9],
      ["Protetor Labial Nivea Hidratante 4,8g", "Nivea", 12.9],
      ["Sabonete Facial Payot Antioleosidade 60g", "Payot", 22.9],
      ["Tônico Facial Payot Extrato de Camomila 200ml", "Payot", 29.9],
      ["Máscara Facial Tracta Argila Verde 60g", "Tracta", 12.9],
      ["Sérum Sallve Renovador Noturno 30ml", "Sallve", 89.9],
      ["Gel de Limpeza Facial Sallve 150ml", "Sallve", 59.9],
      ["Sérum The Ordinary Niacinamide 10% + Zinc 1% 30ml", "The Ordinary", 54.9],
      ["Gel de Limpeza Avène Cleanance 200ml", "Avène", 99.9],
      ["Creme Noturno RoC Retinol Correxion 30g", "RoC", 129.9],
      ["Sérum Simple Organic Vitamina C 30ml", "Simple Organic", 89.9],
      ["Gel de Limpeza Facial Dermage Acniblock 150ml", "Dermage", 79.9],
    ],
  },
  {
    categoria: "Proteção Solar",
    cor: "#f59e0b",
    itens: [
      ["Protetor Solar Sundown FPS 30 200ml", "Sundown", 39.9],
      ["Protetor Solar Sundown FPS 50 120ml", "Sundown", 44.9],
      ["Protetor Solar Sundown Kids FPS 60 100g", "Sundown", 49.9],
      ["Protetor Solar Sundown Sport FPS 50 120ml", "Sundown", 49.9],
      ["Protetor Solar Nivea Sun Protect & Hidrata FPS 50 200ml", "Nivea", 69.9],
      ["Protetor Solar Nivea Sun Kids FPS 60 125ml", "Nivea", 64.9],
      ["Protetor Solar Nivea Sun Beach Protect FPS 30 200ml", "Nivea", 59.9],
      ["Protetor Solar Facial Nivea Sun Rosto FPS 50 50ml", "Nivea", 49.9],
      ["Loção Pós-Sol Nivea Sun Hidratante 200ml", "Nivea", 39.9],
      ["Protetor Solar La Roche-Posay Anthelios XL-Protect FPS 70 200ml", "La Roche-Posay", 129.9],
      ["Protetor Solar La Roche-Posay Anthelios Airlicium+ FPS 70 50g", "La Roche-Posay", 119.9],
      ["Protetor Solar La Roche-Posay Anthelios Pele Acneica FPS 70 50g", "La Roche-Posay", 124.9],
      ["Protetor Solar Vichy Capital Soleil UV-Age Daily FPS 60 40g", "Vichy", 149.9],
      ["Protetor Solar Vichy Idéal Soleil Clarify FPS 60 40g", "Vichy", 139.9],
      ["Protetor Solar ISDIN Fusion Water FPS 60 50ml", "ISDIN", 139.9],
      ["Protetor Solar ISDIN Fusion Water Color FPS 60 50ml", "ISDIN", 149.9],
      ["Protetor Solar Episol Sérum FPS 70 40g", "Mantecorp Skincare", 109.9],
      ["Protetor Solar Neutrogena Sun Fresh FPS 70 200ml", "Neutrogena", 79.9],
      ["Protetor Solar Neutrogena Sun Fresh Rosto FPS 60 40g", "Neutrogena", 59.9],
      ["Protetor Solar Cenoura & Bronze FPS 30 200ml", "Cenoura & Bronze", 44.9],
      ["Bronzeador Cenoura & Bronze FPS 4 120ml", "Cenoura & Bronze", 29.9],
      ["Bronzeador Australian Gold SPF 15 237ml", "Australian Gold", 99.9],
      ["Protetor Solar Avène Fluido FPS 50 50ml", "Avène", 129.9],
      ["Protetor Solar Adcos Ultra Sensitive FPS 50 50g", "Adcos", 139.9],
      ["Protetor Solar Eucerin Sun Oil Control FPS 60 50ml", "Eucerin", 119.9],
    ],
  },
  {
    categoria: "Maquiagem",
    cor: "#f43f5e",
    itens: [
      ["Base Maybelline Fit Me Matte + Poreless 30ml", "Maybelline", 44.9],
      ["Corretivo Maybelline Instant Age Rewind 6ml", "Maybelline", 54.9],
      ["Máscara de Cílios Maybelline The Colossal 10ml", "Maybelline", 39.9],
      ["Pó Compacto Maybelline Fit Me Matte 8,5g", "Maybelline", 39.9],
      ["Batom Maybelline SuperStay Matte Ink 5ml", "Maybelline", 44.9],
      ["Base L'Oréal Infallible 24H Fresh Wear 30ml", "L'Oréal Paris", 79.9],
      ["Máscara de Cílios L'Oréal Volume Million Lashes 9,2ml", "L'Oréal Paris", 59.9],
      ["Delineador L'Oréal Superliner Perfect Slim 6ml", "L'Oréal Paris", 49.9],
      ["Base Vult Matte 30ml", "Vult", 34.9],
      ["Pó Compacto Vult Facial 9g", "Vult", 27.9],
      ["Batom Vult Matte 3,5g", "Vult", 19.9],
      ["Paleta de Sombras Vult 8 Cores", "Vult", 39.9],
      ["Máscara de Cílios Vult Alongadora 8ml", "Vult", 24.9],
      ["Lápis de Olho Vult Preto 1,2g", "Vult", 14.9],
      ["Lápis para Sobrancelha Vult Castanho 1,2g", "Vult", 16.9],
      ["Demaquilante Vult Bifásico 120ml", "Vult", 24.9],
      ["Base Ruby Rose Feels Matte 29ml", "Ruby Rose", 24.9],
      ["Corretivo Ruby Rose Feels Matte 8ml", "Ruby Rose", 16.9],
      ["Paleta de Sombras Ruby Rose Nude 18 Cores", "Ruby Rose", 39.9],
      ["Iluminador Ruby Rose Glow 9g", "Ruby Rose", 19.9],
      ["Esponja de Maquiagem Ruby Rose Gota", "Ruby Rose", 12.9],
      ["Fixador de Maquiagem Ruby Rose Feels Matte 60ml", "Ruby Rose", 24.9],
      ["Base Avon Power Stay 24h 30ml", "Avon", 69.9],
      ["Batom Avon Ultra Matte 3,6g", "Avon", 34.9],
      ["Máscara de Cílios Avon Big & Multiplied 10ml", "Avon", 44.9],
      ["Base O Boticário Make B. Matte 30ml", "O Boticário", 79.9],
      ["Batom O Boticário Intense Matte 3,8g", "O Boticário", 44.9],
      ["Pó Facial O Boticário Make B. Translúcido 9g", "O Boticário", 59.9],
      ["Base Natura Una Alta Cobertura 30ml", "Natura", 89.9],
      ["Batom Natura Una Matte 3,5g", "Natura", 49.9],
      ["Máscara de Cílios Natura Una Volume Extremo 8ml", "Natura", 59.9],
      ["Primer Bruna Tavares BT Blur 30ml", "Bruna Tavares", 69.9],
      ["Base Bruna Tavares BT Skin 30ml", "Bruna Tavares", 79.9],
      ["Blush Bruna Tavares BT Marble 4,5g", "Bruna Tavares", 54.9],
      ["Batom Líquido Payot Matte 4ml", "Payot", 29.9],
    ],
  },
  {
    categoria: "Perfumaria",
    cor: "#8b5cf6",
    itens: [
      ["Desodorante Colônia Natura Kaiak Masculino 100ml", "Natura", 99.9],
      ["Desodorante Colônia Natura Kaiak Feminino 100ml", "Natura", 99.9],
      ["Desodorante Colônia Natura Essencial Masculino 100ml", "Natura", 149.9],
      ["Desodorante Colônia Natura Ekos Castanha 150ml", "Natura", 89.9],
      ["Desodorante Colônia Natura Luna Absoluto 75ml", "Natura", 149.9],
      ["Deo Parfum Natura Ilía 50ml", "Natura", 199.9],
      ["Body Splash Natura Tododia Algodão 200ml", "Natura", 44.9],
      ["Deo Colônia O Boticário Malbec 100ml", "O Boticário", 199.9],
      ["Deo Colônia O Boticário Egeo Dolce 90ml", "O Boticário", 129.9],
      ["Deo Colônia O Boticário Lily 75ml", "O Boticário", 249.9],
      ["Deo Colônia O Boticário Coffee Woman 100ml", "O Boticário", 139.9],
      ["Deo Colônia O Boticário Floratta Blue 75ml", "O Boticário", 119.9],
      ["Deo Colônia O Boticário Glamour Secrets Black 75ml", "O Boticário", 149.9],
      ["Body Splash O Boticário Nativa SPA Ameixa 200ml", "O Boticário", 59.9],
      ["Perfume Avon Far Away 50ml", "Avon", 89.9],
      ["Perfume Avon Little Black Dress 50ml", "Avon", 99.9],
      ["Body Splash Victoria's Secret Love Spell 250ml", "Victoria's Secret", 139.9],
      ["Eau de Parfum Paco Rabanne 1 Million 100ml", "Paco Rabanne", 549.9],
      ["Eau de Toilette Carolina Herrera 212 VIP Men 100ml", "Carolina Herrera", 599.9],
      ["Eau de Parfum Carolina Herrera Good Girl 80ml", "Carolina Herrera", 749.9],
      ["Eau de Toilette Dolce & Gabbana Light Blue 100ml", "Dolce & Gabbana", 649.9],
      ["Eau de Parfum Lancôme La Vie Est Belle 50ml", "Lancôme", 599.9],
      ["Eau de Toilette Calvin Klein CK One 100ml", "Calvin Klein", 299.9],
      ["Eau de Toilette Giorgio Armani Acqua di Giò 100ml", "Giorgio Armani", 649.9],
      ["Eau de Toilette Jean Paul Gaultier Le Male 125ml", "Jean Paul Gaultier", 699.9],
      ["Eau de Toilette Hugo Boss Bottled 100ml", "Hugo Boss", 499.9],
      ["Eau de Toilette Versace Eros 100ml", "Versace", 549.9],
      ["Eau de Toilette Antonio Banderas King of Seduction 100ml", "Antonio Banderas", 129.9],
      ["Eau de Toilette Shakira Dance Diamonds 80ml", "Shakira", 89.9],
      ["Eau de Toilette Natura Homem Essência 100ml", "Natura", 159.9],
    ],
  },
  {
    categoria: "Corpo e Banho",
    cor: "#06b6d4",
    itens: [
      ["Sabonete em Barra Dove Original 90g", "Dove", 4.9],
      ["Sabonete Líquido Dove Original 250ml", "Dove", 19.9],
      ["Hidratante Corporal Dove Body Love Original 400ml", "Dove", 27.9],
      ["Hidratante Corporal Nivea Milk Hidratação Profunda 400ml", "Nivea", 29.9],
      ["Creme Hidratante Nivea Lata 97g", "Nivea", 14.9],
      ["Hidratante Corporal Nivea Aloe Hidratação 400ml", "Nivea", 27.9],
      ["Sabonete em Barra Lux Botanicals Orquídea Negra 85g", "Lux", 3.9],
      ["Sabonete Líquido Lux Botanicals Flor de Cerejeira 250ml", "Lux", 16.9],
      ["Sabonete em Barra Protex Original 85g", "Protex", 3.9],
      ["Sabonete Líquido Protex Antibacteriano 250ml", "Protex", 18.9],
      ["Sabonete em Barra Granado Glicerina Tradicional 90g", "Granado", 7.9],
      ["Sabonete Líquido Granado Bebê Lavanda 250ml", "Granado", 24.9],
      ["Hidratante Corporal Granado Terrapeutics Bergamota 200ml", "Granado", 39.9],
      ["Talco Desodorante Granado Tradicional 100g", "Granado", 19.9],
      ["Hidratante Corporal Natura Tododia Ameixa 400ml", "Natura", 44.9],
      ["Hidratante Corporal Natura Ekos Castanha 400ml", "Natura", 59.9],
      ["Óleo Corporal Natura Ekos Castanha 200ml", "Natura", 54.9],
      ["Hidratante Corporal O Boticário Nativa SPA Karité 400ml", "O Boticário", 69.9],
      ["Creme Hidratante O Boticário Cuide-se Bem Nuvem 250g", "O Boticário", 44.9],
      ["Esfoliante Corporal O Boticário Nativa SPA Ameixa 200g", "O Boticário", 54.9],
      ["Sabonete Líquido Íntimo Intimus Sensitive 200ml", "Intimus", 24.9],
      ["Sabonete em Barra Palmolive Nutri Cuidado Aveia 85g", "Palmolive", 3.5],
      ["Sabonete Líquido Palmolive Naturals Hidratação Delicada 250ml", "Palmolive", 15.9],
      ["Creme para as Mãos Neutrogena Norwegian Formula 56g", "Neutrogena", 34.9],
      ["Creme para os Pés Neutrogena Norwegian Formula 56g", "Neutrogena", 34.9],
      ["Loção Hidratante Corporal Cetaphil 473ml", "Cetaphil", 119.9],
      ["Loção Hidratante Corporal CeraVe 473ml", "CeraVe", 129.9],
      ["Loção Hidratante Eucerin pH5 400ml", "Eucerin", 89.9],
      ["Óleo Corporal Bio-Oil 60ml", "Bio-Oil", 59.9],
      ["Manteiga Corporal The Body Shop Karité 200ml", "The Body Shop", 129.9],
      ["Gel de Banho The Body Shop Morango 250ml", "The Body Shop", 89.9],
      ["Sabonete Líquido Johnson's Baby da Cabeça aos Pés 400ml", "Johnson's", 26.9],
      ["Loção Hidratante Johnson's Baby Hora do Sono 200ml", "Johnson's", 22.9],
      ["Solução Hidratante Bepantol Derma 100ml", "Bayer", 79.9],
      ["Hidratante Corporal Vasenol Cuidado Diário 400ml", "Vasenol", 29.9],
    ],
  },
  {
    categoria: "Desodorantes",
    cor: "#0ea5e9",
    itens: [
      ["Desodorante Aerosol Rexona Motionsense Antibacterial 150ml", "Rexona", 17.9],
      ["Desodorante Aerosol Rexona Clinical Classic 150ml", "Rexona", 34.9],
      ["Desodorante Roll-on Rexona Efficient 50ml", "Rexona", 12.9],
      ["Desodorante Aerosol Rexona Men V8 150ml", "Rexona", 17.9],
      ["Desodorante Aerosol Nivea Dry Comfort 150ml", "Nivea", 18.9],
      ["Desodorante Aerosol Nivea Black & White Invisible 150ml", "Nivea", 19.9],
      ["Desodorante Roll-on Nivea Dry Comfort 50ml", "Nivea", 13.9],
      ["Desodorante Creme Nivea Antitranspirante 55ml", "Nivea", 15.9],
      ["Desodorante Aerosol Dove Original 150ml", "Dove", 19.9],
      ["Desodorante Aerosol Dove Men+Care Invisible Dry 150ml", "Dove", 19.9],
      ["Desodorante Aerosol Dove Antibacterial 150ml", "Dove", 19.9],
      ["Desodorante Aerosol Above Men Extreme 150ml", "Above", 12.9],
      ["Desodorante Roll-on Above Women Sunset 55ml", "Above", 9.9],
      ["Desodorante Aerosol Monange Hidratação Intensa 150ml", "Monange", 14.9],
      ["Desodorante Aerosol Old Spice Lenha 150ml", "Old Spice", 22.9],
      ["Desodorante Aerosol Axe Apollo 150ml", "Axe", 21.9],
      ["Desodorante Aerosol Axe Black 150ml", "Axe", 21.9],
      ["Desodorante Antitranspirante Natura Tododia Algodão 75ml", "Natura", 24.9],
      ["Desodorante Antitranspirante O Boticário Malbec 75ml", "O Boticário", 39.9],
      ["Desodorante Aerosol Bozzano Antitranspirante 150ml", "Bozzano", 16.9],
    ],
  },
  {
    categoria: "Higiene Bucal",
    cor: "#14b8a6",
    itens: [
      ["Creme Dental Colgate Total 12 90g", "Colgate", 12.9],
      ["Creme Dental Colgate Máxima Proteção Anticáries 180g", "Colgate", 9.9],
      ["Creme Dental Colgate Luminous White 70g", "Colgate", 14.9],
      ["Creme Dental Colgate Sensitive Pro-Alívio 90g", "Colgate", 19.9],
      ["Creme Dental Sensodyne Repair & Protect 100g", "Sensodyne", 29.9],
      ["Creme Dental Sensodyne Branqueador 90g", "Sensodyne", 27.9],
      ["Creme Dental Sensodyne Rápido Alívio 100g", "Sensodyne", 31.9],
      ["Creme Dental Oral-B 3D White 70g", "Oral-B", 13.9],
      ["Creme Dental Close Up Red Hot 90g", "Close Up", 8.9],
      ["Creme Dental Sorriso Dentes Brancos 90g", "Sorriso", 4.9],
      ["Enxaguante Bucal Listerine Cool Mint 500ml", "Listerine", 29.9],
      ["Enxaguante Bucal Listerine Zero Álcool 500ml", "Listerine", 32.9],
      ["Enxaguante Bucal Listerine Whitening 500ml", "Listerine", 39.9],
      ["Enxaguante Bucal Colgate Plax Fresh Mint 500ml", "Colgate", 21.9],
      ["Enxaguante Bucal Periogard 500ml", "Periogard", 34.9],
      ["Escova Dental Colgate Twister 3 unidades", "Colgate", 19.9],
      ["Escova Dental Oral-B Indicator Plus Média", "Oral-B", 9.9],
      ["Escova Dental Oral-B Pro-Saúde 7 Benefícios", "Oral-B", 14.9],
      ["Escova Dental Sensodyne Extra Macia", "Sensodyne", 16.9],
      ["Escova Dental Elétrica Oral-B Vitality 100", "Oral-B", 129.9],
      ["Refil Escova Elétrica Oral-B Precision Clean 2 unidades", "Oral-B", 79.9],
      ["Fio Dental Colgate Total 50m", "Colgate", 11.9],
      ["Fio Dental Oral-B Essential Floss 50m", "Oral-B", 13.9],
      ["Fio Dental Sanifill 50m", "Sanifill", 8.9],
      ["Escova Interdental Curaprox CPS Prime 5 unidades", "Curaprox", 39.9],
    ],
  },
  {
    categoria: "Barba e Masculino",
    cor: "#64748b",
    itens: [
      ["Gel de Barbear Gillette Fusion 198g", "Gillette", 24.9],
      ["Espuma de Barbear Gillette Foamy Regular 193g", "Gillette", 16.9],
      ["Aparelho de Barbear Gillette Mach3", "Gillette", 34.9],
      ["Carga Gillette Mach3 4 unidades", "Gillette", 69.9],
      ["Aparelho de Barbear Gillette Fusion5 ProGlide", "Gillette", 54.9],
      ["Carga Gillette Fusion5 2 unidades", "Gillette", 79.9],
      ["Aparelho de Barbear Bic Comfort 3 4 unidades", "Bic", 14.9],
      ["Loção Pós-Barba Nivea Men Sensitive 100ml", "Nivea Men", 34.9],
      ["Gel de Limpeza Facial Nivea Men Deep 100g", "Nivea Men", 24.9],
      ["Hidratante Facial Nivea Men Sensitive 75ml", "Nivea Men", 32.9],
      ["Sabonete em Barra Nivea Men Energy 90g", "Nivea Men", 5.9],
      ["Balm Pós-Barba Bozzano Sensitive 100ml", "Bozzano", 19.9],
      ["Espuma de Barbear Bozzano Tradicional 190g", "Bozzano", 14.9],
      ["Gel Fixador Bozzano Extra Forte 300g", "Bozzano", 17.9],
      ["Pomada Modeladora Bozzano Efeito Matte 60g", "Bozzano", 24.9],
      ["Shampoo para Barba QOD Barber Shop 240ml", "QOD Barber Shop", 39.9],
      ["Pomada Modeladora QOD Barber Shop Matte 100g", "QOD Barber Shop", 44.9],
      ["Óleo para Barba Don Alcides Fábrica de Barba 30ml", "Don Alcides", 44.9],
      ["Shampoo Anticaspa Clear Men Sports 400ml", "Clear", 29.9],
      ["Barbeador Elétrico Philips OneBlade QP2530", "Philips", 199.9],
    ],
  },
  {
    categoria: "Bem-estar e Suplementos",
    cor: "#22c55e",
    itens: [
      ["Vitamina C 1g Redoxon 10 comprimidos efervescentes", "Redoxon", 24.9],
      ["Vitamina C Efervescente Vitasay 10 comprimidos", "Vitasay", 19.9],
      ["Polivitamínico Centrum Homem 30 comprimidos", "Centrum", 69.9],
      ["Polivitamínico Centrum Mulher 30 comprimidos", "Centrum", 69.9],
      ["Multivitamínico A-Z Vitgold 60 comprimidos", "Vitgold", 29.9],
      ["Vitamina D3 2000UI Sundown 60 cápsulas", "Sundown Naturals", 44.9],
      ["Ômega 3 1000mg Sundown 60 cápsulas", "Sundown Naturals", 59.9],
      ["Biotina Sundown 60 cápsulas", "Sundown Naturals", 49.9],
      ["Cálcio + Vitamina D Sundown 60 comprimidos", "Sundown Naturals", 44.9],
      ["Colágeno Hidrolisado Verisol Sanavita 300g", "Sanavita", 129.9],
      ["Colágeno Vitafor Collagen Skin 330g", "Vitafor", 149.9],
      ["Magnésio Dimalato Vitafor 120 cápsulas", "Vitafor", 79.9],
      ["Zinco Quelato Vitafor 60 cápsulas", "Vitafor", 39.9],
      ["Melatonina 210mcg Vitafor 60 cápsulas", "Vitafor", 49.9],
      ["Probiótico Simfort Vitafor 30 sachês", "Vitafor", 109.9],
      ["Whey Protein Concentrado Growth 1kg", "Growth Supplements", 129.9],
      ["Creatina Monohidratada Growth 250g", "Growth Supplements", 89.9],
      ["Glutamina Growth 250g", "Growth Supplements", 69.9],
      ["Whey Protein Isolado Max Titanium 900g", "Max Titanium", 189.9],
      ["Creatina Monohidratada Max Titanium 300g", "Max Titanium", 119.9],
      ["BCAA 2400 Integralmedica 100 cápsulas", "Integralmedica", 79.9],
      ["Whey Protein 3W Integralmedica 900g", "Integralmedica", 149.9],
      ["Termogênico Lipo 6 Black Nutrex 60 cápsulas", "Nutrex", 129.9],
      ["Óleo de Coco Extra Virgem Copra 200ml", "Copra", 24.9],
      ["Chá Verde Leão Ervas 10 sachês", "Leão", 6.9],
    ],
  },
];

// ─── Infra ───────────────────────────────────────────────────────────────────

function loadEnv() {
  const file = path.resolve(".env.local");
  if (!fs.existsSync(file)) {
    throw new Error("`.env.local` não encontrado — rode a partir da raiz do projeto.");
  }
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .replace(/\r/g, "")
      .split("\n")
      .filter((line) => /^[A-Z]/.test(line))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function rest(pathname, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${pathname}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${pathname} → ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function slugify(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── Execução ────────────────────────────────────────────────────────────────

const dryRun = process.argv.includes("--dry-run");
const undo = process.argv.includes("--undo");

const todosItens = CATALOGO.flatMap((bloco) =>
  bloco.itens.map(([name, fabricante, preco]) => ({
    name,
    fabricante,
    preco,
    categoria: bloco.categoria,
  })),
);

async function main() {
  const nomes = todosItens.map((i) => i.name);
  const duplicadosNoCatalogo = nomes.filter((n, i) => nomes.indexOf(n) !== i);
  if (duplicadosNoCatalogo.length > 0) {
    throw new Error(`Nomes repetidos no catálogo: ${duplicadosNoCatalogo.join(", ")}`);
  }

  console.log(`Catálogo: ${todosItens.length} produtos em ${CATALOGO.length} categorias.`);

  if (undo) {
    // Remove por nome — só o que este script cria.
    let removidos = 0;
    for (const lote of chunk(nomes, 40)) {
      const filtro = lote.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(",");
      const apagados = await rest(`/products?name=in.(${encodeURIComponent(filtro)})`, {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      });
      removidos += apagados.length;
    }
    console.log(`Removidos ${removidos} produtos.`);
    return;
  }

  // Quem já está no banco (inclusive soft-deleted, pra não recriar duplicata).
  const existentes = await rest(`/products?select=name`);
  const jaExiste = new Set(existentes.map((p) => p.name));
  const novos = todosItens.filter((i) => !jaExiste.has(i.name));

  console.log(`Já no banco: ${todosItens.length - novos.length}. A inserir: ${novos.length}.`);

  // Um admin qualquer só pra preencher created_by (a coluna é nullable).
  const [admin] = await rest(
    `/users?select=id,role_id&limit=1&role_id=eq.${
      (await rest(`/roles?select=id&key=eq.admin`))[0].id
    }`,
  );

  if (dryRun) {
    console.log("\n--dry-run: nada foi gravado. Amostra do que entraria:");
    for (const item of novos.slice(0, 5)) {
      console.log(`  · [${item.categoria}] ${item.name} — R$ ${item.preco.toFixed(2)}`);
    }
    return;
  }

  // 1) Categorias (reaproveita as que já existem pelo nome).
  const categoriasExistentes = await rest(`/categories?select=id,name&deleted_at=is.null`);
  const categoriaPorNome = new Map(categoriasExistentes.map((c) => [c.name, c.id]));

  const categoriasFaltando = CATALOGO.filter((b) => !categoriaPorNome.has(b.categoria));
  if (categoriasFaltando.length > 0) {
    const criadas = await rest(`/categories`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(
        categoriasFaltando.map((b) => ({
          name: b.categoria,
          slug: slugify(b.categoria),
          color: b.cor,
          organization_id: null,
        })),
      ),
    });
    for (const c of criadas) categoriaPorNome.set(c.name, c.id);
    console.log(`Categorias criadas: ${criadas.map((c) => c.name).join(", ")}`);
  }

  if (novos.length === 0) {
    console.log("Nada a inserir — banco já está populado.");
    return;
  }

  // 2) Produtos (sem imagem e sem código de barras, de propósito).
  const inseridos = [];
  for (const lote of chunk(novos, 50)) {
    const criados = await rest(`/products`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(
        lote.map((item) => ({
          name: item.name,
          description: `${item.categoria} · ${item.fabricante}`,
          barcode: null,
          image_url: null,
          category: item.categoria,
          fabricante: item.fabricante,
          price_unit_store: item.preco,
          created_by: admin?.id ?? null,
          organization_id: null,
        })),
      ),
    });
    inseridos.push(...criados);
    process.stdout.write(`  inseridos ${inseridos.length}/${novos.length}\r`);
  }
  console.log(`\nProdutos inseridos: ${inseridos.length}`);

  // 3) Vínculo formal produto ↔ categoria (product_categories).
  const categoriaDoProduto = new Map(novos.map((i) => [i.name, i.categoria]));
  const vinculos = inseridos
    .map((p) => ({
      product_id: p.id,
      category_id: categoriaPorNome.get(categoriaDoProduto.get(p.name)),
    }))
    .filter((v) => v.category_id);

  for (const lote of chunk(vinculos, 100)) {
    await rest(`/product_categories`, { method: "POST", body: JSON.stringify(lote) });
  }
  console.log(`Vínculos produto↔categoria: ${vinculos.length}`);
}

main().catch((err) => {
  console.error("\nFalhou:", err.message);
  process.exit(1);
});
