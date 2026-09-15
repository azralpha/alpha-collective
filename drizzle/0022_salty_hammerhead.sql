CREATE TABLE `cartRewardClaims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderReference` varchar(40) NOT NULL,
	`userId` int NOT NULL,
	`tierId` int NOT NULL,
	`rewardType` enum('alpha_wallet_credit','free_shipping','catalog_gift') NOT NULL,
	`rewardValue` int NOT NULL DEFAULT 0,
	`giftOfficialProductId` int,
	`cartSubtotal` int NOT NULL,
	`profitAmount` int NOT NULL,
	`profitMarginPercent` int NOT NULL,
	`status` enum('pending_payment','credited','gift_added','cancelled','voided') NOT NULL DEFAULT 'pending_payment',
	`idempotencyKey` varchar(140) NOT NULL,
	`settledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cartRewardClaims_id` PRIMARY KEY(`id`),
	CONSTRAINT `cartRewardClaims_orderReference_unique` UNIQUE(`orderReference`),
	CONSTRAINT `cartRewardClaims_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `cartRewardTiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`minimumSpend` int NOT NULL,
	`rewardType` enum('alpha_wallet_credit','free_shipping','catalog_gift') NOT NULL,
	`rewardValue` int NOT NULL DEFAULT 0,
	`giftOfficialProductId` int,
	`profitSafeguardMargin` int NOT NULL DEFAULT 25,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cartRewardTiers_id` PRIMARY KEY(`id`)
);
