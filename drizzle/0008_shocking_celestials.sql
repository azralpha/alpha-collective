CREATE TABLE `walletBankRecipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bankCode` varchar(24) NOT NULL,
	`bankName` varchar(120) NOT NULL,
	`accountNumberMasked` varchar(24) NOT NULL,
	`accountName` varchar(160) NOT NULL,
	`paystackRecipientCode` varchar(64) NOT NULL,
	`verifiedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `walletBankRecipients_id` PRIMARY KEY(`id`),
	CONSTRAINT `walletBankRecipients_userId_unique` UNIQUE(`userId`)
);
