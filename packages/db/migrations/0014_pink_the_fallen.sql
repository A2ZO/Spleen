CREATE TABLE "artist_follows" (
	"user_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_follows_user_id_artist_id_pk" PRIMARY KEY("user_id","artist_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "notify_releases" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_follows" ADD CONSTRAINT "artist_follows_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_follows" ADD CONSTRAINT "artist_follows_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artist_follows_artist_idx" ON "artist_follows" USING btree ("artist_id");