ALTER TABLE `escrowAllocations` MODIFY COLUMN `status` enum('pending','held','released','refunded') NOT NULL DEFAULT 'held';--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `paymentStatus` enum('pending','paid','cod_pending','wallet_escrow','wallet_released','gateway_escrow','gateway_released','refunded') NOT NULL;--> statement-breakpoint
ALTER TABLE `walletFundingAttempts` ADD `provider` enum('paystack','flutterwave') DEFAULT 'paystack' NOT NULL;--> statement-breakpoint
ALTER TABLE `walletFundingAttempts` ADD `orderReference` varchar(40);