ALTER TABLE `kycProfiles` ADD `diditSessionId` varchar(64);--> statement-breakpoint
ALTER TABLE `kycProfiles` ADD `diditStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `kycProfiles` ADD `diditUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `kycProfiles` ADD CONSTRAINT `kycProfiles_diditSessionId_unique` UNIQUE(`diditSessionId`);