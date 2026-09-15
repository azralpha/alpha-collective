CREATE TABLE `bonusRewardHolds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletId` int NOT NULL,
	`userId` int NOT NULL,
	`orderReference` varchar(40) NOT NULL,
	`referralShareId` int,
	`type` enum('referral','cashback','review') NOT NULL,
	`beneficiary` enum('sharer','referred','customer') NOT NULL,
	`amount` int NOT NULL,
	`status` enum('pending','released','cancelled','voided') NOT NULL DEFAULT 'pending',
	`releaseAt` timestamp NOT NULL,
	`releasedAt` timestamp,
	`cancelledAt` timestamp,
	`idempotencyKey` varchar(140) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bonusRewardHolds_id` PRIMARY KEY(`id`),
	CONSTRAINT `bonusRewardHolds_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `referralFraudChecks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referralShareId` int NOT NULL,
	`referredUserId` int NOT NULL,
	`status` enum('clear','flagged') NOT NULL,
	`reason` enum('none','same_device','same_ip') NOT NULL DEFAULT 'none',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referralFraudChecks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referralRewardSettings` (
	`id` int NOT NULL,
	`minimumFirstOrderSubtotal` int NOT NULL DEFAULT 5000,
	`referralBonusAmount` int NOT NULL DEFAULT 500,
	`rewardReleaseScheduleTaskUid` varchar(65),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referralRewardSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userSecuritySignals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceFingerprintHash` varchar(128),
	`ipHash` varchar(128),
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSecuritySignals_id` PRIMARY KEY(`id`),
	CONSTRAINT `userSecuritySignals_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `wallets` RENAME COLUMN `availableBalance` TO `withdrawableBalance`;--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `fulfillmentStatus` enum('pending','delivered','cancelled','returned') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `referralShares` MODIFY COLUMN `status` enum('shared','qualified','rewarded','voided') NOT NULL DEFAULT 'shared';--> statement-breakpoint
ALTER TABLE `referralShares` MODIFY COLUMN `rewardStatus` enum('none','issued','pending','released','redeemed','cancelled','voided') NOT NULL DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `walletTransactions` MODIFY COLUMN `type` enum('deposit','withdrawal','purchase_escrow','bonus_purchase','refund','sale_earning','reward_bonus') NOT NULL;--> statement-breakpoint
ALTER TABLE `walletTransactions` MODIFY COLUMN `status` enum('pending','completed','held','released','failed','reversed','cancelled','voided') NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `deliveredAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `returnedAt` timestamp;--> statement-breakpoint
ALTER TABLE `referralShares` ADD `minimumOrderSubtotal` int DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE `referralShares` ADD `referredUserId` int;--> statement-breakpoint
ALTER TABLE `referralShares` ADD `fraudStatus` enum('clear','flagged') DEFAULT 'clear' NOT NULL;--> statement-breakpoint
ALTER TABLE `referralShares` ADD `fraudReason` varchar(80);--> statement-breakpoint
ALTER TABLE `walletTransactions` ADD `balanceBucket` enum('withdrawable','bonus') DEFAULT 'withdrawable' NOT NULL;--> statement-breakpoint
ALTER TABLE `wallets` ADD `bonusBalance` int DEFAULT 0 NOT NULL;