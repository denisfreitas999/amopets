ALTER TABLE `orders` ADD `shippingMode` enum('fixed','quote','unavailable') DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE `shipping_rules` ADD `city` varchar(100);--> statement-breakpoint
ALTER TABLE `shipping_rules` ADD `state` varchar(2);--> statement-breakpoint
ALTER TABLE `shipping_rules` ADD `mode` enum('fixed','quote','unavailable') DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE `shipping_rules` ADD `priority` int DEFAULT 0 NOT NULL;