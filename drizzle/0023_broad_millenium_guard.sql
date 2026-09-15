ALTER TABLE `officialProducts` ADD `categoryId` varchar(64) DEFAULT 'fashion' NOT NULL;--> statement-breakpoint
ALTER TABLE `officialProducts` ADD `categorySlug` varchar(64) DEFAULT 'fashion' NOT NULL;--> statement-breakpoint
ALTER TABLE `officialProducts` ADD `isPublished` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `officialProducts` ADD `publicationStatus` enum('DRAFT','APPROVED','REJECTED') DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE `officialProducts` ADD `inStock` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `vendorProducts` ADD `categoryId` varchar(64) DEFAULT 'fashion' NOT NULL;--> statement-breakpoint
ALTER TABLE `vendorProducts` ADD `categorySlug` varchar(64) DEFAULT 'fashion' NOT NULL;--> statement-breakpoint
ALTER TABLE `vendorProducts` ADD `isPublished` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `vendorProducts` ADD `publicationStatus` enum('DRAFT','APPROVED','REJECTED') DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE `vendorProducts` ADD `inStock` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `vendorRewardProfiles` ADD `averageRatingTenths` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `vendorRewardProfiles` ADD `ratingCount` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `officialProducts`
SET `categoryId` = CASE `category`
  WHEN 'Fashion' THEN 'fashion'
  WHEN 'Gadgets' THEN 'gadgets'
  WHEN 'Beauty' THEN 'beauty'
  WHEN 'Home & Furniture' THEN 'home-furniture'
  WHEN 'Vehicles' THEN 'vehicles'
  WHEN 'Animals & Pets' THEN 'animals-pets'
END,
`categorySlug` = CASE `category`
  WHEN 'Fashion' THEN 'fashion'
  WHEN 'Gadgets' THEN 'gadgets'
  WHEN 'Beauty' THEN 'beauty'
  WHEN 'Home & Furniture' THEN 'home-furniture'
  WHEN 'Vehicles' THEN 'vehicles'
  WHEN 'Animals & Pets' THEN 'animals-pets'
END,
`isPublished` = CASE WHEN `status` = 'active' THEN 1 ELSE 0 END,
`publicationStatus` = CASE WHEN `status` = 'active' THEN 'APPROVED' WHEN `status` = 'rejected' THEN 'REJECTED' ELSE 'DRAFT' END,
`inStock` = CASE WHEN `status` = 'active' AND (`stockQuantity` IS NULL OR `stockQuantity` > 0) THEN 1 ELSE 0 END,
`stockQuantity` = CASE WHEN `status` = 'active' AND `stockQuantity` IS NULL THEN 1 ELSE `stockQuantity` END;
--> statement-breakpoint
UPDATE `vendorProducts`
SET `categoryId` = CASE `category`
  WHEN 'Fashion' THEN 'fashion'
  WHEN 'Gadgets' THEN 'gadgets'
  WHEN 'Beauty' THEN 'beauty'
  WHEN 'Home & Furniture' THEN 'home-furniture'
  WHEN 'Vehicles' THEN 'vehicles'
  WHEN 'Animals & Pets' THEN 'animals-pets'
END,
`categorySlug` = CASE `category`
  WHEN 'Fashion' THEN 'fashion'
  WHEN 'Gadgets' THEN 'gadgets'
  WHEN 'Beauty' THEN 'beauty'
  WHEN 'Home & Furniture' THEN 'home-furniture'
  WHEN 'Vehicles' THEN 'vehicles'
  WHEN 'Animals & Pets' THEN 'animals-pets'
END,
`isPublished` = CASE WHEN `status` = 'active' THEN 1 ELSE 0 END,
`publicationStatus` = CASE WHEN `status` = 'active' THEN 'APPROVED' WHEN `status` = 'rejected' THEN 'REJECTED' ELSE 'DRAFT' END,
`inStock` = CASE WHEN `status` = 'active' THEN 1 ELSE 0 END;
