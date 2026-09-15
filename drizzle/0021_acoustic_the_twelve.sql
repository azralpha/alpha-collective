ALTER TABLE `withdrawalOtpChallenges` ADD `processingFee` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `withdrawalRequests` ADD `processingFee` int DEFAULT 0 NOT NULL;