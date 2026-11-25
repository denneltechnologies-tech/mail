CREATE TABLE IF NOT EXISTS `businesses` (
	`id` varchar(191) PRIMARY KEY NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(191) NOT NULL UNIQUE,
	`max_users` bigint NOT NULL DEFAULT 10,
	`features` text NOT NULL,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `businesses_slug_idx` ON `businesses` (`slug`);
--> statement-breakpoint
ALTER TABLE `users` ADD `business_id` varchar(191);
--> statement-breakpoint
CREATE INDEX `users_business_idx` ON `users` (`business_id`);
--> statement-breakpoint
ALTER TABLE `domains` ADD `business_id` varchar(191);
--> statement-breakpoint
CREATE INDEX `domains_business_idx` ON `domains` (`business_id`);
--> statement-breakpoint
ALTER TABLE `mailboxes` ADD `business_id` varchar(191);
--> statement-breakpoint
CREATE INDEX `mailboxes_business_idx` ON `mailboxes` (`business_id`);
