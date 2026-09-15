CREATE TABLE `escrowAllocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderReference` varchar(40) NOT NULL,
	`buyerWalletId` int NOT NULL,
	`vendorUserId` int NOT NULL,
	`grossAmount` int NOT NULL,
	`commissionAmount` int NOT NULL,
	`netAmount` int NOT NULL,
	`status` enum('held','released','refunded') NOT NULL DEFAULT 'held',
	`releasedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `escrowAllocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `walletTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','withdrawal','purchase_escrow','refund','sale_earning') NOT NULL,
	`direction` enum('in','out') NOT NULL,
	`status` enum('pending','completed','held','released','failed','reversed') NOT NULL,
	`amount` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`reference` varchar(64) NOT NULL,
	`idempotencyKey` varchar(120) NOT NULL,
	`orderReference` varchar(40),
	`description` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `walletTransactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `walletTransactions_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`availableBalance` int NOT NULL DEFAULT 0,
	`escrowBalance` int NOT NULL DEFAULT 0,
	`pinHash` varchar(255),
	`pinFailedAttempts` int NOT NULL DEFAULT 0,
	`pinLockedUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallets_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `withdrawalRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletId` int NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`status` enum('pending','processing','paid','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`providerReference` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `withdrawalRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `paymentMethod` enum('delivery','paystack','flutterwave','wallet') NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `paymentStatus` enum('pending','paid','cod_pending','wallet_escrow','wallet_released','refunded') NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `fulfillmentStatus` enum('pending','delivered','cancelled') DEFAULT 'pending' NOT NULL;