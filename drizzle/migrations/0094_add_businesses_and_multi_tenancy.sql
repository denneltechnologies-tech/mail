CREATE TABLE IF NOT EXISTS `businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`max_users` integer DEFAULT 10 NOT NULL,
	`features` text DEFAULT '["branding","shared_mailboxes","forwarding","drive","calendar","ai_assistant"]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `businesses_slug_idx` ON `businesses` (`slug`);
--> statement-breakpoint
ALTER TABLE `users` ADD `business_id` text REFERENCES `businesses`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `users_business_idx` ON `users` (`business_id`);
--> statement-breakpoint
ALTER TABLE `domains` ADD `business_id` text REFERENCES `businesses`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `domains_business_idx` ON `domains` (`business_id`);
--> statement-breakpoint
ALTER TABLE `mailboxes` ADD `business_id` text REFERENCES `businesses`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `mailboxes_business_idx` ON `mailboxes` (`business_id`);
