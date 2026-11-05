ALTER TABLE economy_account ADD COLUMN IF NOT EXISTS last_daily_at timestamptz;
--> statement-breakpoint
ALTER TABLE economy_account ADD COLUMN IF NOT EXISTS daily_streak integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE economy_account ADD CONSTRAINT economy_account_daily_streak_non_negative CHECK (daily_streak >= 0);
