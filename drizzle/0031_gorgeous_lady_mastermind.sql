CREATE TABLE `telegramInquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inquiryId` varchar(32) NOT NULL,
	`buyerUserId` int NOT NULL,
	`vendorUserId` int NOT NULL,
	`vendorApplicationId` int NOT NULL,
	`productId` int NOT NULL,
	`productTitle` varchar(180) NOT NULL,
	`productPrice` int NOT NULL,
	`buyerQuestion` text NOT NULL,
	`telegramVendorMessageId` varchar(80),
	`telegramGroupMessageId` varchar(80),
	`telegramReplyPromptMessageId` varchar(80),
	`status` enum('pending','replied','failed') NOT NULL DEFAULT 'pending',
	`vendorReply` text,
	`repliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegramInquiries_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegramInquiries_inquiryId_unique` UNIQUE(`inquiryId`)
);
--> statement-breakpoint
ALTER TABLE `vendorApplications` ADD `telegramVendorId` varchar(180);--> statement-breakpoint
ALTER TABLE `vendorApplications` ADD `telegramChatId` varchar(80);--> statement-breakpoint
ALTER TABLE `vendorApplications` ADD `telegramUserId` varchar(80);--> statement-breakpoint
ALTER TABLE `vendorApplications` ADD `telegramLinkedAt` timestamp;--> statement-breakpoint
ALTER TABLE `vendorApplications` ADD CONSTRAINT `vendorApplications_telegramVendorId_unique` UNIQUE(`telegramVendorId`);