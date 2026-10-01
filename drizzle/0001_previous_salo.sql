CREATE TABLE `available_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weekday` int NOT NULL,
	`time` varchar(8) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `available_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(160) NOT NULL,
	`whatsapp` varchar(40) NOT NULL,
	`petName` varchar(100) NOT NULL,
	`serviceName` varchar(120) NOT NULL,
	`petSize` enum('small','medium','large') NOT NULL DEFAULT 'medium',
	`date` varchar(12) NOT NULL,
	`time` varchar(8) NOT NULL,
	`status` enum('requested','confirmed','refused','completed') NOT NULL DEFAULT 'requested',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`discountType` enum('percentage','fixed') NOT NULL,
	`discountValue` decimal(10,2) NOT NULL,
	`expiresAt` timestamp,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`variantId` int,
	`productName` varchar(180) NOT NULL,
	`variantLabel` varchar(80),
	`quantity` int NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(160) NOT NULL,
	`whatsapp` varchar(40) NOT NULL,
	`cep` varchar(12),
	`street` varchar(180),
	`number` varchar(30),
	`neighborhood` varchar(100),
	`city` varchar(100),
	`state` varchar(2),
	`complement` varchar(180),
	`paymentMethod` varchar(50) NOT NULL,
	`couponCode` varchar(40),
	`subtotal` decimal(10,2) NOT NULL,
	`shippingFee` decimal(10,2) NOT NULL,
	`discount` decimal(10,2) NOT NULL DEFAULT '0',
	`total` decimal(10,2) NOT NULL,
	`status` enum('received','preparing','out_for_delivery','delivered') NOT NULL DEFAULT 'received',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`url` text NOT NULL,
	`alt` varchar(180),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isCover` boolean NOT NULL DEFAULT false,
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_specs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`label` varchar(80) NOT NULL,
	`value` varchar(180) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_specs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`label` varchar(80) NOT NULL,
	`sku` varchar(80) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`oldPrice` decimal(10,2),
	`stock` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_variants_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(180) NOT NULL,
	`name` varchar(180) NOT NULL,
	`category` varchar(80) NOT NULL,
	`subcategory` varchar(100) NOT NULL,
	`description` text,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `shipping_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(100) NOT NULL,
	`neighborhoods` text NOT NULL,
	`fee` decimal(10,2) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `shipping_rules_id` PRIMARY KEY(`id`)
);
