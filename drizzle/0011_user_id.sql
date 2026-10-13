ALTER TABLE `orders` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `bookings` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `orders_userId_idx` ON `orders` (`userId`);--> statement-breakpoint
CREATE INDEX `bookings_userId_idx` ON `bookings` (`userId`);