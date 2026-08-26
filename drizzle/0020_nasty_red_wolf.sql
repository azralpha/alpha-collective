ALTER TABLE `officialProducts` ADD `aiCleanTitle` varchar(180);--> statement-breakpoint
ALTER TABLE `officialProducts` ADD `aiSeoDescription` text;--> statement-breakpoint
ALTER TABLE `officialProducts` ADD `aiMetaDescription` varchar(155);--> statement-breakpoint
ALTER TABLE `officialProducts` ADD `aiSuggestedTags` json;--> statement-breakpoint
ALTER TABLE `officialProducts` ADD `aiEnhancedAt` timestamp;