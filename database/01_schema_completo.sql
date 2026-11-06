-- ============================================================================
-- AMOPETS — 01. SCHEMA COMPLETO DO BANCO DE DADOS (MYSQL / MARIADB)
-- ============================================================================
-- Compatível com: phpMyAdmin, MySQL 8+, MariaDB 10+
-- 
-- Instruções de uso:
-- 1. No phpMyAdmin ou terminal MySQL, selecione o banco de dados da AmoPets;
-- 2. Cole e execute este script completo de uma só vez;
-- 3. Todas as 14 tabelas oficiais serão criadas já com colunas, índices e
--    chaves estrangeiras no estado final e consolidado;
-- 4. Em seguida, execute o script '02_dados_iniciais.sql' para criar o admin
--    e as configurações padrão de frete, serviços e horários.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- 1. Usuários do site (clientes logados via Google)
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `openId` varchar(64) NOT NULL,
  `name` text DEFAULT NULL,
  `email` varchar(320) DEFAULT NULL,
  `loginMethod` varchar(64) DEFAULT NULL,
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_openId_unique` (`openId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Usuários administrativos do painel (/admin)
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(160) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `name` varchar(160) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastLoginAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `admin_users_username_unique` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Catálogo de Produtos
CREATE TABLE IF NOT EXISTS `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `slug` varchar(180) NOT NULL,
  `name` varchar(180) NOT NULL,
  `category` varchar(80) NOT NULL,
  `subcategory` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Variantes de Produtos (tamanhos, pesos, estoque e preços)
CREATE TABLE IF NOT EXISTS `product_variants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `productId` int(11) NOT NULL,
  `label` varchar(80) NOT NULL,
  `sku` varchar(80) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `oldPrice` decimal(10,2) DEFAULT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_variants_sku_unique` (`sku`),
  KEY `product_variants_productId_idx` (`productId`),
  CONSTRAINT `product_variants_productId_fk` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Imagens dos Produtos (arquivos WebP persistidos)
CREATE TABLE IF NOT EXISTS `product_images` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `productId` int(11) NOT NULL,
  `url` text NOT NULL,
  `alt` varchar(180) DEFAULT NULL,
  `sortOrder` int(11) NOT NULL DEFAULT 0,
  `isCover` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `product_images_productId_idx` (`productId`),
  CONSTRAINT `product_images_productId_fk` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Especificações Técnicas dos Produtos
CREATE TABLE IF NOT EXISTS `product_specs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `productId` int(11) NOT NULL,
  `label` varchar(80) NOT NULL,
  `value` varchar(180) NOT NULL,
  `sortOrder` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `product_specs_productId_idx` (`productId`),
  CONSTRAINT `product_specs_productId_fk` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Sequência Contínua de Pedidos
CREATE TABLE IF NOT EXISTS `order_number_sequence` (
  `id` int(11) NOT NULL,
  `nextNumber` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Pedidos
CREATE TABLE IF NOT EXISTS `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) DEFAULT NULL,
  `orderNumber` int(11) NOT NULL,
  `customerName` varchar(160) NOT NULL,
  `whatsapp` varchar(40) NOT NULL,
  `cep` varchar(12) DEFAULT NULL,
  `street` varchar(180) DEFAULT NULL,
  `number` varchar(30) DEFAULT NULL,
  `neighborhood` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(2) DEFAULT NULL,
  `complement` varchar(180) DEFAULT NULL,
  `paymentMethod` varchar(50) NOT NULL,
  `couponCode` varchar(40) DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `shippingFee` decimal(10,2) NOT NULL,
  `discount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL,
  `shippingMode` enum('fixed','quote','unavailable') NOT NULL DEFAULT 'fixed',
  `status` enum('received','preparing','out_for_delivery','delivered','cancelled') NOT NULL DEFAULT 'received',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_orderNumber_unique` (`orderNumber`),
  KEY `orders_userId_idx` (`userId`),
  CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Itens do Pedido
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `orderId` int(11) NOT NULL,
  `productId` int(11) NOT NULL,
  `variantId` int(11) DEFAULT NULL,
  `productName` varchar(180) NOT NULL,
  `variantLabel` varchar(80) DEFAULT NULL,
  `quantity` int(11) NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_items_orderId_idx` (`orderId`),
  CONSTRAINT `order_items_orderId_fk` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Agendamentos de Banho e Tosa
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) DEFAULT NULL,
  `customerName` varchar(160) NOT NULL,
  `whatsapp` varchar(40) NOT NULL,
  `petName` varchar(100) NOT NULL,
  `serviceName` varchar(120) NOT NULL,
  `petSize` enum('small','medium','large') NOT NULL DEFAULT 'medium',
  `date` varchar(12) NOT NULL,
  `time` varchar(8) NOT NULL,
  `status` enum('requested','confirmed','refused','completed') NOT NULL DEFAULT 'requested',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bookings_userId_idx` (`userId`),
  CONSTRAINT `bookings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Serviços de Banho e Tosa (preços por porte do animal)
CREATE TABLE IF NOT EXISTS `grooming_services` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `description` varchar(220) DEFAULT NULL,
  `priceSmall` decimal(10,2) NOT NULL,
  `priceMedium` decimal(10,2) NOT NULL,
  `priceLarge` decimal(10,2) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `sortOrder` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `grooming_services_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Grade de Horários Semanais Disponíveis
CREATE TABLE IF NOT EXISTS `available_slots` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `weekday` int(11) NOT NULL,
  `time` varchar(8) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `available_slots_weekday_time` (`weekday`,`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Regras de Frete e Entregas
CREATE TABLE IF NOT EXISTS `shipping_rules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ruleType` enum('local_neighborhoods','other_cities','other_regions') NOT NULL DEFAULT 'other_regions',
  `neighborhoods` text NOT NULL,
  `fee` decimal(10,2) NOT NULL,
  `city` varchar(100) DEFAULT NULL,
  `mode` enum('fixed','quote','unavailable') NOT NULL DEFAULT 'fixed',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Cupons de Desconto
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(40) NOT NULL,
  `discountType` enum('percentage','fixed') NOT NULL,
  `discountValue` decimal(10,2) NOT NULL,
  `expiresAt` timestamp NULL DEFAULT NULL,
  `maxUses` int(11) DEFAULT NULL,
  `usedCount` int(11) NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupons_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

