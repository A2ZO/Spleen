ALTER TABLE "reports" DROP CONSTRAINT "reports_reporter_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "follows_followee_idx";--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "reporter_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "group_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_lang_created_idx" ON "reviews" USING btree ("lang","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "entries_user_created_idx" ON "entries" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "comments_user_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comments_created_idx" ON "comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "follows_follower_created_idx" ON "follows" USING btree ("follower_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "follows_followee_created_idx" ON "follows" USING btree ("followee_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "likes_created_idx" ON "likes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_group_idx" ON "notifications" USING btree ("user_id","group_key");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_once_uidx" ON "notifications" USING btree ("user_id","actor_id","type",coalesce("review_id", "list_id", "user_id")) WHERE "notifications"."type" in ('follow', 'like');--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_once_uidx" ON "reports" USING btree ("reporter_id",coalesce("reported_user_id", "review_id", "list_id", "comment_id", "release_id", "track_id", "artist_id")) WHERE "reports"."status" = 'open' and "reports"."reporter_id" is not null;