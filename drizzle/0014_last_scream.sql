CREATE TABLE `freeDeliveryVouchers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`earnedMonth` varchar(7) NOT NULL,
	`status` enum('active','redeemed','cancelled','expired') NOT NULL DEFAULT 'active',
	`earnedOrderReference` varchar(40) NOT NULL,
	`redeemedOrderReference` varchar(40),
	`idempotencyKey` varchar(140) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`redeemedAt` timestamp,
	CONSTRAINT `freeDeliveryVouchers_id` PRIMARY KEY(`id`),
	CONSTRAINT `freeDeliveryVouchers_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `rewardGrants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('kyc_completion','vendor_dispatch','vendor_leaderboard') NOT NULL,
	`amount` int NOT NULL,
	`status` enum('pending','released','cancelled','voided') NOT NULL DEFAULT 'pending',
	`sourceOrderReference` varchar(40),
	`rewardMonth` varchar(7),
	`releaseAt` timestamp,
	`releasedAt` timestamp,
	`cancelledAt` timestamp,
	`idempotencyKey` varchar(140) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rewardGrants_id` PRIMARY KEY(`id`),
	CONSTRAINT `rewardGrants_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `rewardsAutomationSettings` (
	`id` int NOT NULL,
	`monthlyVendorRewardsScheduleTaskUid` varchar(65),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rewardsAutomationSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendorCommissionOverrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendorUserId` int NOT NULL,
	`rewardMonth` varchar(7) NOT NULL,
	`commissionRate` int NOT NULL DEFAULT 0,
	`qualifyingDeliveries` int NOT NULL,
	`idempotencyKey` varchar(140) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendorCommissionOverrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `vendorCommissionOverrides_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `vendorDispatchEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderReference` varchar(40) NOT NULL,
	`vendorUserId` int NOT NULL,
	`dispatchedAt` timestamp NOT NULL,
	`onTime` int NOT NULL DEFAULT 0,
	`idempotencyKey` varchar(140) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendorDispatchEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `vendorDispatchEvents_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `vendorRewardProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendorUserId` int NOT NULL,
	`hasLightningSellerBadge` int NOT NULL DEFAULT 0,
	`lightningBadgeAwardedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vendorRewardProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `vendorRewardProfiles_vendorUserId_unique` UNIQUE(`vendorUserId`)
);
