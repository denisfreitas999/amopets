ALTER TABLE `shipping_rules` ADD `ruleType` enum('local_neighborhoods','other_cities','other_regions') DEFAULT 'other_regions' NOT NULL;--> statement-breakpoint
UPDATE `shipping_rules` SET `ruleType` = CASE WHEN `scope` = 'neighborhoods' THEN 'local_neighborhoods' WHEN `city` IS NOT NULL AND TRIM(`city`) <> '' THEN 'other_cities' ELSE 'other_regions' END;--> statement-breakpoint
UPDATE `shipping_rules` SET `mode` = 'quote', `fee` = '0.00' WHERE `ruleType` = 'other_regions';--> statement-breakpoint
INSERT INTO `shipping_rules` (`label`, `ruleType`, `neighborhoods`, `fee`, `city`, `mode`, `active`)
SELECT 'Outras regiões', 'other_regions', '', '0.00', NULL, 'quote', 1
WHERE NOT EXISTS (SELECT 1 FROM `shipping_rules` WHERE `ruleType` = 'other_regions');--> statement-breakpoint
ALTER TABLE `shipping_rules` DROP COLUMN `label`;--> statement-breakpoint
ALTER TABLE `shipping_rules` DROP COLUMN `scope`;--> statement-breakpoint
ALTER TABLE `shipping_rules` DROP COLUMN `priority`;
