CREATE TABLE `escrowReleaseSettings` (
	`id` int NOT NULL,
	`scheduleTaskUid` varchar(65),
	`lastStartedAt` timestamp,
	`lastCompletedAt` timestamp,
	`lastError` varchar(255),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `escrowReleaseSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `escrowReleaseSettings_scheduleTaskUid_unique` UNIQUE(`scheduleTaskUid`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `buyerConfirmedAt` timestamp;