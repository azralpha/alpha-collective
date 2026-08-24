CREATE TABLE `walletFundingAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletId` int NOT NULL,
	`userId` int NOT NULL,
	`reference` varchar(64) NOT NULL,
	`amount` int NOT NULL,
	`status` enum('pending','succeeded','failed') NOT NULL DEFAULT 'pending',
	`providerTransactionId` varchar(64),
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `walletFundingAttempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `walletFundingAttempts_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
ALTER TABLE `withdrawalRequests` MODIFY COLUMN `status` enum('pending','processing','paid','rejected','failed','reversed','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `withdrawalRequests` ADD `recipientId` int;--> statement-breakpoint
ALTER TABLE `withdrawalRequests` ADD `transferReference` varchar(64);--> statement-breakpoint
ALTER TABLE `withdrawalRequests` ADD `providerTransferCode` varchar(64);--> statement-breakpoint
ALTER TABLE `withdrawalRequests` ADD `reversedAt` timestamp;--> statement-breakpoint
ALTER TABLE `withdrawalRequests` ADD CONSTRAINT `withdrawalRequests_transferReference_unique` UNIQUE(`transferReference`);