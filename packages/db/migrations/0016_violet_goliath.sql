ALTER TYPE "public"."notification_type" ADD VALUE 'release';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "release_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_release_once_uidx" ON "notifications" USING btree ("user_id","release_id") WHERE "notifications"."release_id" is not null;--> statement-breakpoint
CREATE INDEX "notifications_release_idx" ON "notifications" USING btree ("release_id") WHERE "notifications"."release_id" is not null;