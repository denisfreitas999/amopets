CREATE TABLE `order_number_sequence` (
	`id` int NOT NULL,
	`nextNumber` int NOT NULL,
	CONSTRAINT `order_number_sequence_id` PRIMARY KEY(`id`)
);

ALTER TABLE `orders` ADD `orderNumber` int NULL;

SET @amopets_order_number = 0;

UPDATE `orders` SET `orderNumber` = (@amopets_order_number := @amopets_order_number + 1) ORDER BY `createdAt`, `id`;

ALTER TABLE `orders` MODIFY `orderNumber` int NOT NULL;

CREATE UNIQUE INDEX `orders_orderNumber_unique` ON `orders` (`orderNumber`);

INSERT INTO `order_number_sequence` (`id`, `nextNumber`)
SELECT 1, COALESCE(MAX(`orderNumber`), 0) + 1 FROM `orders`;
