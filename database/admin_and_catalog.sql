
-- Variações extras para demonstrar preço "a partir de" e estoque por variante.
INSERT INTO product_variants (productId, label, sku, price, oldPrice, stock)
SELECT id, '3 kg', 'AMP-RACAO-3KG', 279.90, 319.90, 6 FROM products WHERE slug = 'racao-premier-ambientes-internos'
ON DUPLICATE KEY UPDATE price = VALUES(price), oldPrice = VALUES(oldPrice), stock = VALUES(stock);
INSERT INTO product_variants (productId, label, sku, price, oldPrice, stock)
SELECT id, '10 kg', 'AMP-RACAO-10KG', 399.90, 449.90, 4 FROM products WHERE slug = 'racao-premier-ambientes-internos'
ON DUPLICATE KEY UPDATE price = VALUES(price), oldPrice = VALUES(oldPrice), stock = VALUES(stock);
UPDATE product_variants SET stock = 0 WHERE sku = 'AMP-CORDA-M';
