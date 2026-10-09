-- Migração AmoPets: regras de frete com tipos fixos
ALTER TABLE `shipping_rules` ADD `ruleType` enum('local_neighborhoods','other_cities','other_regions') DEFAULT 'other_regions' NOT NULL;
UPDATE `shipping_rules`
SET `ruleType` = CASE
  WHEN `scope` = 'neighborhoods' THEN 'local_neighborhoods'
  WHEN `city` IS NOT NULL AND TRIM(`city`) <> '' THEN 'other_cities'
  ELSE 'other_regions'
END;
UPDATE `shipping_rules` SET `mode` = 'quote', `fee` = '0.00' WHERE `ruleType` = 'other_regions';
INSERT INTO `shipping_rules` (`label`, `ruleType`, `neighborhoods`, `fee`, `city`, `mode`, `active`)
SELECT 'Outras regiões', 'other_regions', '', '0.00', NULL, 'quote', 1
WHERE NOT EXISTS (SELECT 1 FROM `shipping_rules` WHERE `ruleType` = 'other_regions');
ALTER TABLE `shipping_rules` DROP COLUMN `label`;
ALTER TABLE `shipping_rules` DROP COLUMN `scope`;
ALTER TABLE `shipping_rules` DROP COLUMN `priority`;
