ALTER TYPE "public"."listen_format" ADD VALUE 'download' BEFORE 'live';--> statement-breakpoint
ALTER TYPE "public"."listen_format" ADD VALUE 'radio' BEFORE 'live';--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "listened_on" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "time_zone" text DEFAULT 'Europe/Paris' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "entries_undated_release_uidx" ON "entries" USING btree ("user_id","release_id") WHERE "entries"."listened_on" is null and "entries"."release_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "entries_undated_track_uidx" ON "entries" USING btree ("user_id","track_id") WHERE "entries"."listened_on" is null and "entries"."track_id" is not null;