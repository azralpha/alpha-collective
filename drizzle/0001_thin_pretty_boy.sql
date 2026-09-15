CREATE TABLE `orders` (
	`reference` varchar(40) NOT NULL,
	`buyerName` varchar(120) NOT NULL,
	`buyerPhone` varchar(32) NOT NULL,
	`deliveryAddress` text NOT NULL,
	`paymentMethod` enum('delivery','paystack','flutterwave') NOT NULL,
	`paymentStatus` enum('pending','paid','cod_pending') NOT NULL,
	`subtotal` int NOT NULL,
	`referralDiscount` int NOT NULL DEFAULT 0,
	`deliveryFee` int NOT NULL,
	`total` int NOT NULL,
	`referralCode` varchar(32),
	`orderLines` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orders_reference` PRIMARY KEY(`reference`)
);
--> statement-breakpoint
CREATE TABLE `referralShares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareCode` varchar(32) NOT NULL,
	`channel` enum('whatsapp','tiktok','instagram','other') NOT NULL,
	`status` enum('shared','qualified','rewarded') NOT NULL DEFAULT 'shared',
	`rewardValue` int NOT NULL DEFAULT 500,
	`referredOrderReference` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referralShares_id` PRIMARY KEY(`id`),
	CONSTRAINT `referralShares_shareCode_unique` UNIQUE(`shareCode`)
);
--> statement-breakpoint
CREATE TABLE `vendorApplications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`storeName` varchar(160) NOT NULL,
	`whatsapp` varchar(32) NOT NULL,
	`category` enum('Fashion','Phones','Beauty','Home') NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`commissionRate` int NOT NULL DEFAULT 12,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendorApplications_id` PRIMARY KEY(`id`),
	CONSTRAINT `vendorApplications_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `vendorProducts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendorApplicationId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`category` enum('Fashion','Phones','Beauty','Home') NOT NULL,
	`price` int NOT NULL,
	`description` text NOT NULL,
	`status` enum('draft','active') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendorProducts_id` PRIMARY KEY(`id`)
);
