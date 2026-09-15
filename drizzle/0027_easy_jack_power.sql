CREATE TABLE `userAchievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`achievementKey` varchar(64) NOT NULL,
	`label` varchar(100) NOT NULL,
	`description` varchar(255) NOT NULL,
	`awardedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userAchievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userAddresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`label` varchar(60) NOT NULL,
	`recipientName` varchar(120) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`country` varchar(60) NOT NULL DEFAULT 'Nigeria',
	`state` varchar(80) NOT NULL,
	`lga` varchar(100) NOT NULL,
	`streetDetails` varchar(255) NOT NULL,
	`isDefault` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userAddresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userFollowedVendors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vendorUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userFollowedVendors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userLoyaltyProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`points` int NOT NULL DEFAULT 0,
	`level` varchar(40) NOT NULL DEFAULT 'Newcomer',
	`lifetimeSpend` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userLoyaltyProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `userLoyaltyProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(80);--> statement-breakpoint
ALTER TABLE `users` ADD `profileImageUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `legalName` varchar(160);--> statement-breakpoint
ALTER TABLE `users` ADD `dateOfBirth` varchar(10);--> statement-breakpoint
ALTER TABLE `users` ADD `legalIdentityLockedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);