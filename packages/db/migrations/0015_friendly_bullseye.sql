ALTER TABLE "releases" ADD COLUMN "announced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "release_date_changed_at" timestamp with time zone;