CREATE TYPE "public"."listen_service" AS ENUM('spotify', 'deezer', 'apple_music', 'youtube_music', 'bandcamp');--> statement-breakpoint
CREATE TABLE "listen_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid,
	"track_id" uuid,
	"artist_id" uuid,
	"service" "listen_service" NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listen_links_one_target" CHECK (num_nonnulls("listen_links"."release_id", "listen_links"."track_id", "listen_links"."artist_id") = 1),
	CONSTRAINT "listen_links_https" CHECK ("listen_links"."url" like 'https://%')
);
--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "links_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "links_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listen_links" ADD CONSTRAINT "listen_links_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listen_links" ADD CONSTRAINT "listen_links_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listen_links" ADD CONSTRAINT "listen_links_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listen_links_release_uidx" ON "listen_links" USING btree ("release_id","service") WHERE "listen_links"."release_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "listen_links_track_uidx" ON "listen_links" USING btree ("track_id","service") WHERE "listen_links"."track_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "listen_links_artist_uidx" ON "listen_links" USING btree ("artist_id","service") WHERE "listen_links"."artist_id" is not null;