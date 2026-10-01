ALTER TABLE `coupons` ADD `maxUses` int;
ALTER TABLE `coupons` ADD `usedCount` int DEFAULT 0 NOT NULL;