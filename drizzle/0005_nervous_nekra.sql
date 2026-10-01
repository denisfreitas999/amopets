ALTER TABLE `coupons` ADD `maxUses` int;--> statement-breakpoint
ALTER TABLE `coupons` ADD `usedCount` int DEFAULT 0 NOT NULL;