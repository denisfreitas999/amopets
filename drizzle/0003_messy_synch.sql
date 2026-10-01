CREATE TABLE `grooming_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(220),
	`priceSmall` decimal(10,2) NOT NULL,
	`priceMedium` decimal(10,2) NOT NULL,
	`priceLarge` decimal(10,2) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `grooming_services_id` PRIMARY KEY(`id`),
	CONSTRAINT `grooming_services_name_unique` UNIQUE(`name`)
);
