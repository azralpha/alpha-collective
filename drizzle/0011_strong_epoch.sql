CREATE TABLE `fulfilmentIntegrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('cj_dropshipping','custom_webhook') NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`apiBaseUrl` varchar(500),
	`callbackUrl` varchar(500),
	`defaultLogisticsName` varchar(80),
	`defaultFromCountryCode` varchar(8),
	`orderMode` enum('create_only','balance_payment') NOT NULL DEFAULT 'create_only',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fulfilmentIntegrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `fulfilmentIntegrations_provider_unique` UNIQUE(`provider`)
);
--> statement-breakpoint
CREATE TABLE `fulfilmentJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderReference` varchar(40) NOT NULL,
	`officialProductId` int NOT NULL,
	`provider` enum('cj_dropshipping','custom_webhook') NOT NULL,
	`status` enum('queued','processing','submitted','retry_pending','manual_required','skipped') NOT NULL DEFAULT 'queued',
	`externalSkuSnapshot` varchar(120) NOT NULL,
	`quantity` int NOT NULL,
	`deliverySnapshot` json NOT NULL,
	`providerOrderId` varchar(200),
	`providerRequestId` varchar(80),
	`errorSummary` varchar(255),
	`attemptCount` int NOT NULL DEFAULT 0,
	`nextAttemptAt` timestamp,
	`claimedAt` timestamp,
	`submittedAt` timestamp,
	`idempotencyKey` varchar(140) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fulfilmentJobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `fulfilmentJobs_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `officialProductSourcing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`officialProductId` int NOT NULL,
	`fulfillmentProvider` enum('local_vendor','auto_fulfill_api','manual_admin') NOT NULL DEFAULT 'manual_admin',
	`externalSkuId` varchar(120),
	`supplierCost` int,
	`supplierCurrency` enum('NGN','USD') NOT NULL DEFAULT 'USD',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `officialProductSourcing_id` PRIMARY KEY(`id`),
	CONSTRAINT `officialProductSourcing_officialProductId_unique` UNIQUE(`officialProductId`)
);
--> statement-breakpoint
CREATE TABLE `officialProducts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(180) NOT NULL,
	`category` enum('Fashion','Gadgets','Beauty','Home & Furniture','Vehicles','Animals & Pets') NOT NULL,
	`price` int NOT NULL,
	`formerPrice` int,
	`badge` varchar(80),
	`description` text NOT NULL,
	`detail` text NOT NULL,
	`imageUrl` text,
	`imageUrls` json,
	`status` enum('draft','active','rejected') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `officialProducts_id` PRIMARY KEY(`id`)
);
