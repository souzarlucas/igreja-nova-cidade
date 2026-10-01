ALTER TABLE users ADD COLUMN finance_access INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE audit ADD COLUMN detail TEXT NOT NULL DEFAULT '{}';

--> statement-breakpoint
ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE users SET is_owner=1 WHERE id=(SELECT id FROM users WHERE role='admin' ORDER BY rowid LIMIT 1);
