-- Migração AmoPets: regras de frete simplificadas
ALTER TABLE `shipping_rules` ADD `scope` enum('neighborhoods','citywide') DEFAULT 'citywide' NOT NULL;
ALTER TABLE `shipping_rules` DROP COLUMN `state`;
UPDATE `shipping_rules`
SET `scope` = CASE WHEN TRIM(`neighborhoods`) <> '' THEN 'neighborhoods' ELSE 'citywide' END;
