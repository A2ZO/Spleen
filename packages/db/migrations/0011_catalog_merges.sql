ALTER TYPE "public"."report_reason" ADD VALUE 'catalog_cover' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."report_reason" ADD VALUE 'catalog_duplicate' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "merged_into_id" uuid;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "merged_into_id" uuid;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "merged_into_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "duplicate_release_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "duplicate_track_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "duplicate_artist_id" uuid;--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_merged_into_id_artists_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_merged_into_id_releases_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_merged_into_id_tracks_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_duplicate_release_id_releases_id_fk" FOREIGN KEY ("duplicate_release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_duplicate_track_id_tracks_id_fk" FOREIGN KEY ("duplicate_track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_duplicate_artist_id_artists_id_fk" FOREIGN KEY ("duplicate_artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_not_merged_into_itself" CHECK ("artists"."merged_into_id" <> "artists"."id");--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_not_merged_into_itself" CHECK ("releases"."merged_into_id" <> "releases"."id");--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_not_merged_into_itself" CHECK ("tracks"."merged_into_id" <> "tracks"."id");--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_duplicate_pair" CHECK (("reports"."reason"::text = 'catalog_duplicate') = (num_nonnulls("reports"."duplicate_release_id", "reports"."duplicate_track_id", "reports"."duplicate_artist_id") = 1)
        and ("reports"."duplicate_release_id" is null or "reports"."release_id" is not null)
        and ("reports"."duplicate_track_id" is null or "reports"."track_id" is not null)
        and ("reports"."duplicate_artist_id" is null or "reports"."artist_id" is not null)
        and (num_nonnulls("reports"."duplicate_release_id", "reports"."duplicate_track_id", "reports"."duplicate_artist_id") = 0 or coalesce("reports"."duplicate_release_id", "reports"."duplicate_track_id", "reports"."duplicate_artist_id") <> coalesce("reports"."release_id", "reports"."track_id", "reports"."artist_id")));