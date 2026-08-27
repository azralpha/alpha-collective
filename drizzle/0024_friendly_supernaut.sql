CREATE TABLE `spinPromotionSettings` (
	`id` int NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`profitSafeguardMargin` int NOT NULL DEFAULT 25,
	`countdownMinutes` int NOT NULL DEFAULT 20,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spinPromotionSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spinRewardClaims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`visitorHash` varchar(64) NOT NULL,
	`userId` int,
	`rewardName` varchar(120) NOT NULL,
	`rewardOfficialProductId` int NOT NULL,
	`rewardCost` int NOT NULL,
	`minimumSpend` int NOT NULL,
	`profitSafeguardMargin` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`orderReference` varchar(40),
	`status` enum('claimed','pending_payment','gift_added','cancelled','expired') NOT NULL DEFAULT 'claimed',
	`settledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spinRewardClaims_id` PRIMARY KEY(`id`),
	CONSTRAINT `spinRewardClaims_tokenHash_unique` UNIQUE(`tokenHash`),
	CONSTRAINT `spinRewardClaims_orderReference_unique` UNIQUE(`orderReference`)
);
