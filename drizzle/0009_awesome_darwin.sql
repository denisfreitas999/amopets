ALTER TABLE `shipping_rules` ADD `scope` enum('neighborhoods','citywide') DEFAULT 'citywide' NOT NULL;--> statement-breakpoint
ALTER TABLE `shipping_rules` DROP COLUMN `state`;