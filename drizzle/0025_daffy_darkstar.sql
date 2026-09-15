CREATE TABLE `newsletterCampaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdByUserId` int NOT NULL,
	`subject` varchar(180) NOT NULL,
	`htmlBody` text NOT NULL,
	`productSnapshot` json NOT NULL,
	`recipientCount` int NOT NULL DEFAULT 0,
	`status` enum('draft','sending','sent','failed') NOT NULL DEFAULT 'draft',
	`sendStartedAt` timestamp,
	`sentAt` timestamp,
	`failureSummary` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `newsletterCampaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsletterDeliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`subscriberId` int NOT NULL,
	`status` enum('sending','sent','failed','skipped') NOT NULL DEFAULT 'sending',
	`providerMessageId` varchar(120),
	`failureSummary` varchar(255),
	`idempotencyKey` varchar(140) NOT NULL,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `newsletterDeliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletterDeliveries_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `newsletterSubscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`unsubscribeTokenHash` varchar(64) NOT NULL,
	`lastEmailedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `newsletterSubscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletterSubscribers_email_unique` UNIQUE(`email`),
	CONSTRAINT `newsletterSubscribers_unsubscribeTokenHash_unique` UNIQUE(`unsubscribeTokenHash`)
);
