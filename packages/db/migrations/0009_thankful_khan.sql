DROP INDEX "lists_user_idx";--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "discography_refreshed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "entries_created_idx" ON "entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "entries_undated_updated_idx" ON "entries" USING btree ("updated_at") WHERE "entries"."listened_on" is null;--> statement-breakpoint
CREATE INDEX "lists_user_idx" ON "lists" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_release_unique" UNIQUE("list_id","release_id");--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_track_unique" UNIQUE("list_id","track_id");--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_artist_unique" UNIQUE("list_id","artist_id");