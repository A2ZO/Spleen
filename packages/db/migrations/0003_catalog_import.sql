ALTER TABLE "artists" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "discography_imported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "secondary_types" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "tracklist_imported_at" timestamp with time zone;