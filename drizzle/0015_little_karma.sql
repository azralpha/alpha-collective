CREATE TABLE `cjImportBatchItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`submittedSku` varchar(120) NOT NULL,
	`normalizedSku` varchar(120) NOT NULL,
	`status` enum('queued','processing','imported','skipped','failed') NOT NULL DEFAULT 'queued',
	`officialProductId` int,
	`errorSummary` varchar(255),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cjImportBatchItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cjImportBatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestedByUserId` int NOT NULL,
	`requestedSkuCount` int NOT NULL,
	`processedSkuCount` int NOT NULL DEFAULT 0,
	`succeededSkuCount` int NOT NULL DEFAULT 0,
	`failedSkuCount` int NOT NULL DEFAULT 0,
	`markupPercent` decimal(7,2) NOT NULL,
	`exchangeRateNgnPerUsd` decimal(12,2) NOT NULL,
	`category` enum('Fashion','Gadgets','Beauty','Home & Furniture','Vehicles','Animals & Pets') NOT NULL,
	`destinationCountryCode` varchar(8) NOT NULL DEFAULT 'NG',
	`status` enum('queued','processing','completed','completed_with_errors','failed') NOT NULL DEFAULT 'queued',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `cjImportBatches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `fulfilmentIntegrations` ADD `inventorySyncScheduleTaskUid` varchar(65);--> statement-breakpoint
ALTER TABLE `fulfilmentIntegrations` ADD `inventorySyncLastStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `fulfilmentIntegrations` ADD `inventorySyncLastCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `fulfilmentIntegrations` ADD `inventorySyncLastError` varchar(255);--> statement-breakpoint
ALTER TABLE `officialProductSourcing` ADD `externalProductId` varchar(200);--> statement-breakpoint
ALTER TABLE `officialProductSourcing` ADD `externalVariantId` varchar(200);--> statement-breakpoint
ALTER TABLE `officialProductSourcing` ADD `supplierProductCost` decimal(12,2);--> statement-breakpoint
ALTER TABLE `officialProductSourcing` ADD `supplierShippingCost` decimal(12,2);--> statement-breakpoint
ALTER TABLE `officialProductSourcing` ADD `supplierInventoryQuantity` int;--> statement-breakpoint
ALTER TABLE `officialProductSourcing` ADD `supplierInventoryCountryCode` varchar(8);--> statement-breakpoint
ALTER TABLE `officialProducts` ADD `stockQuantity` int;--> statement-breakpoint
ALTER TABLE `officialProducts` ADD `inventorySyncedAt` timestamp;--> statement-breakpoint
ALTER TABLE `officialProducts` ADD `inventorySyncStatus` enum('not_managed','current','stale','error') DEFAULT 'not_managed' NOT NULL;--> statement-breakpoint
ALTER TABLE `fulfilmentIntegrations` ADD CONSTRAINT `fulfilmentIntegrations_inventorySyncScheduleTaskUid_unique` UNIQUE(`inventorySyncScheduleTaskUid`);
