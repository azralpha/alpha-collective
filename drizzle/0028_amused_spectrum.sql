CREATE TABLE `giftCardPurchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(80) NOT NULL,
	`purchaserUserId` int NOT NULL,
	`amount` int NOT NULL,
	`purchaserEmail` varchar(320) NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`status` enum('PENDING','PAID','FAILED') NOT NULL DEFAULT 'PENDING',
	`providerTransactionId` varchar(80),
	`giftCardId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`paidAt` timestamp,
	CONSTRAINT `giftCardPurchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `giftCardPurchases_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `giftCards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`initialBalance` int NOT NULL,
	`currentBalance` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'NGN',
	`purchaserEmail` varchar(320) NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`status` enum('ACTIVE','EXPIRED','EXHAUSTED') NOT NULL DEFAULT 'ACTIVE',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `giftCards_id` PRIMARY KEY(`id`),
	CONSTRAINT `giftCards_codeHash_unique` UNIQUE(`codeHash`)
);
