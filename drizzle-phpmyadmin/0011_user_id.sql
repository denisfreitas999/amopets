ALTER TABLE `orders` ADD `userId` int;
ALTER TABLE `bookings` ADD `userId` int;
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
CREATE INDEX `orders_userId_idx` ON `orders` (`userId`);
CREATE INDEX `bookings_userId_idx` ON `bookings` (`userId`);

