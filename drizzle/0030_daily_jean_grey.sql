CREATE TABLE `taskTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(80) NOT NULL,
	`externalTxId` varchar(160) NOT NULL,
	`taskName` varchar(180),
	`payoutAmount` int NOT NULL,
	`status` enum('PENDING','COMPLETED','REVERSED') NOT NULL DEFAULT 'PENDING',
	`holdUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taskTransactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `taskTransactions_externalTxId_unique` UNIQUE(`externalTxId`)
);
