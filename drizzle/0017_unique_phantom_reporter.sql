CREATE TABLE `cryptoFundingAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletId` int NOT NULL,
	`userId` int NOT NULL,
	`reference` varchar(64) NOT NULL,
	`amountNaira` int NOT NULL,
	`payCurrency` varchar(24) NOT NULL,
	`providerPaymentId` varchar(80),
	`quotedPayAmount` decimal(24,12),
	`payAddress` text,
	`quoteExpiresAt` timestamp NOT NULL,
	`status` enum('pending','confirmed','failed','expired') NOT NULL DEFAULT 'pending',
	`creditedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cryptoFundingAttempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `cryptoFundingAttempts_reference_unique` UNIQUE(`reference`),
	CONSTRAINT `cryptoFundingAttempts_providerPaymentId_unique` UNIQUE(`providerPaymentId`)
);
