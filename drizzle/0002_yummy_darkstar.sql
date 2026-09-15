ALTER TABLE `orders` ADD `buyerUserId` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `discountType` enum('none','referral','reward') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `referralShares` ADD `sharerUserId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `referralShares` ADD `rewardCode` varchar(32);--> statement-breakpoint
ALTER TABLE `referralShares` ADD `rewardStatus` enum('none','issued','redeemed') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `referralShares` ADD CONSTRAINT `referralShares_rewardCode_unique` UNIQUE(`rewardCode`);