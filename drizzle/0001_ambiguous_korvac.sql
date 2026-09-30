ALTER TABLE `records` ADD `budget_key` text;--> statement-breakpoint
CREATE INDEX `records_kind_ministry` ON `records` (`kind`,`ministry`);--> statement-breakpoint
CREATE UNIQUE INDEX `budget_period_unique` ON `records` (`budget_key`);--> statement-breakpoint
CREATE INDEX `audit_time` ON `audit` (`time`);--> statement-breakpoint
CREATE INDEX `session_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expiry` ON `sessions` (`expires`);