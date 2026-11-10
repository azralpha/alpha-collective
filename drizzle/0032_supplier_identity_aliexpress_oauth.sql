CREATE TABLE `supplierOAuthCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(32) NOT NULL,
	`encryptedAccessToken` text NOT NULL,
	`encryptedRefreshToken` text NOT NULL,
	`accessTokenExpiresAt` timestamp NOT NULL,
	`refreshTokenExpiresAt` timestamp,
	`accountId` varchar(180),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplierOAuthCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `supplierOAuthCredentials_provider_unique` UNIQUE(`provider`)
);
--> statement-breakpoint
ALTER TABLE `cjImportBatchItems` ADD `previewImageUrl` text;--> statement-breakpoint
ALTER TABLE `cjImportBatches` ADD `supplierId` varchar(32) DEFAULT 'cj_dropshipping' NOT NULL;--> statement-breakpoint
ALTER TABLE `officialProductSourcing` ADD `supplierIdentity` varchar(255);--> statement-breakpoint
ALTER TABLE `officialProductSourcing` ADD CONSTRAINT `officialProductSourcing_supplierIdentity_unique` UNIQUE(`supplierIdentity`);