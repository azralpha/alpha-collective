CREATE TABLE `kycProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('not_started','identity_pending','identity_verified','bank_pending','verified','rejected') NOT NULL DEFAULT 'not_started',
	`submittedLegalName` varchar(160),
	`verifiedLegalName` varchar(160),
	`governmentIdImageUrl` text,
	`smileJobId` varchar(120),
	`failureReason` varchar(255),
	`identityVerifiedAt` timestamp,
	`bankVerifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kycProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `kycProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `withdrawalOtpChallenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recipientId` int NOT NULL,
	`amount` int NOT NULL,
	`otpHash` varchar(255) NOT NULL,
	`status` enum('pending_delivery','delivered','consumed','expired','failed','locked') NOT NULL DEFAULT 'pending_delivery',
	`attempts` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `withdrawalOtpChallenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `walletBankRecipients` ADD `kycBindingStatus` enum('unverified','verified','locked') DEFAULT 'unverified' NOT NULL;