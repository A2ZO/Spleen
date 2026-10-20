CREATE TYPE "public"."push_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."subscription_platform" AS ENUM('stripe', 'apple', 'google');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."theme_preference" AS ENUM('dark', 'light');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TYPE "public"."date_precision" AS ENUM('year', 'month', 'day');--> statement-breakpoint
CREATE TYPE "public"."release_type" AS ENUM('album', 'ep', 'single');--> statement-breakpoint
CREATE TYPE "public"."listen_format" AS ENUM('vinyl', 'cd', 'cassette', 'streaming', 'live', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('follow', 'like', 'comment');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'hate', 'spoiler', 'inappropriate', 'catalog_error', 'catalog_addition', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."import_kind" AS ENUM('release_group', 'artist', 'recording');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"banner_url" text,
	"locale" varchar(8) DEFAULT 'fr' NOT NULL,
	"theme" "theme_preference" DEFAULT 'dark' NOT NULL,
	"stats_private" boolean DEFAULT false NOT NULL,
	"diary_private" boolean DEFAULT false NOT NULL,
	"blind_mode" boolean DEFAULT false NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"age_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" "push_platform" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "subscription_platform" NOT NULL,
	"status" "subscription_status" NOT NULL,
	"external_id" text NOT NULL,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_name" text,
	"disambiguation" text,
	"country" varchar(2),
	"image_url" text,
	"mbid" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artists_slug_unique" UNIQUE("slug"),
	CONSTRAINT "artists_mbid_unique" UNIQUE("mbid")
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "genres_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "release_artists" (
	"release_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"position" smallint DEFAULT 1 NOT NULL,
	"credit_name" text,
	CONSTRAINT "release_artists_release_id_artist_id_pk" PRIMARY KEY("release_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "release_genres" (
	"release_id" uuid NOT NULL,
	"genre_id" uuid NOT NULL,
	CONSTRAINT "release_genres_release_id_genre_id_pk" PRIMARY KEY("release_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "release_tracks" (
	"release_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"disc" smallint DEFAULT 1 NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "release_tracks_release_id_disc_position_pk" PRIMARY KEY("release_id","disc","position")
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"type" "release_type" NOT NULL,
	"release_date" date,
	"release_date_precision" date_precision,
	"cover_url" text,
	"language" varchar(8),
	"mbid" uuid,
	"reference_release_mbid" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "releases_slug_unique" UNIQUE("slug"),
	CONSTRAINT "releases_mbid_unique" UNIQUE("mbid")
);
--> statement-breakpoint
CREATE TABLE "track_artists" (
	"track_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"position" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "track_artists_track_id_artist_id_pk" PRIMARY KEY("track_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"duration_ms" integer,
	"mbid" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracks_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tracks_mbid_unique" UNIQUE("mbid")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"release_id" uuid NOT NULL,
	CONSTRAINT "favorites_user_id_position_pk" PRIMARY KEY("user_id","position"),
	CONSTRAINT "favorites_user_release_unique" UNIQUE("user_id","release_id"),
	CONSTRAINT "favorites_position_range" CHECK ("favorites"."position" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"release_id" uuid,
	"track_id" uuid,
	"artist_id" uuid,
	"position" integer NOT NULL,
	"note" text,
	CONSTRAINT "list_items_one_target" CHECK (num_nonnulls("list_items"."release_id", "list_items"."track_id", "list_items"."artist_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"ranked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_id" uuid,
	"release_id" uuid,
	"track_id" uuid,
	"artist_id" uuid,
	"rating" smallint,
	"body" text NOT NULL,
	"lang" varchar(8) NOT NULL,
	"pinned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_one_target" CHECK (num_nonnulls("reviews"."release_id", "reviews"."track_id", "reviews"."artist_id") = 1),
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"release_id" uuid,
	"track_id" uuid,
	"artist_id" uuid,
	"listened_on" date NOT NULL,
	"rating" smallint,
	"liked" boolean DEFAULT false NOT NULL,
	"is_relisten" boolean DEFAULT false NOT NULL,
	"format" "listen_format",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entries_one_target" CHECK (num_nonnulls("entries"."release_id", "entries"."track_id", "entries"."artist_id") = 1),
	CONSTRAINT "entries_rating_range" CHECK ("entries"."rating" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "entry_moods" (
	"entry_id" uuid NOT NULL,
	"mood_id" uuid NOT NULL,
	CONSTRAINT "entry_moods_entry_id_mood_id_pk" PRIMARY KEY("entry_id","mood_id")
);
--> statement-breakpoint
CREATE TABLE "moods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner_id" uuid,
	"label_fr" text NOT NULL,
	"label_en" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_ratings" (
	"entry_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	CONSTRAINT "track_ratings_entry_id_track_id_pk" PRIMARY KEY("entry_id","track_id"),
	CONSTRAINT "track_ratings_rating_range" CHECK ("track_ratings"."rating" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "user_item_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"release_id" uuid,
	"track_id" uuid,
	"artist_id" uuid,
	"rating" smallint,
	"liked" boolean DEFAULT false NOT NULL,
	"listened" boolean DEFAULT false NOT NULL,
	"want_to_listen" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_item_state_one_target" CHECK (num_nonnulls("user_item_state"."release_id", "user_item_state"."track_id", "user_item_state"."artist_id") = 1),
	CONSTRAINT "user_item_state_rating_range" CHECK ("user_item_state"."rating" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "blocks_not_self" CHECK ("blocks"."blocker_id" <> "blocks"."blocked_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"review_id" uuid,
	"list_id" uuid,
	"body" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_one_subject" CHECK (num_nonnulls("comments"."review_id", "comments"."list_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" uuid NOT NULL,
	"followee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id"),
	CONSTRAINT "follows_not_self" CHECK ("follows"."follower_id" <> "follows"."followee_id")
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"review_id" uuid,
	"list_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "likes_one_subject" CHECK (num_nonnulls("likes"."review_id", "likes"."list_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" "notification_type" NOT NULL,
	"review_id" uuid,
	"list_id" uuid,
	"comment_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_user_id" uuid,
	"review_id" uuid,
	"list_id" uuid,
	"comment_id" uuid,
	"release_id" uuid,
	"track_id" uuid,
	"artist_id" uuid,
	"reason" "report_reason" NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_one_subject" CHECK (num_nonnulls("reports"."reported_user_id", "reports"."review_id", "reports"."list_id", "reports"."comment_id", "reports"."release_id", "reports"."track_id", "reports"."artist_id") = 1 or ("reports"."reason" = 'catalog_addition' and num_nonnulls("reports"."reported_user_id", "reports"."review_id", "reports"."list_id", "reports"."comment_id", "reports"."release_id", "reports"."track_id", "reports"."artist_id") = 0))
);
--> statement-breakpoint
CREATE TABLE "catalog_import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "import_kind" NOT NULL,
	"mbid" uuid NOT NULL,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"requested_by_id" uuid,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_import_jobs_kind_mbid_unique" UNIQUE("kind","mbid")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"next_allowed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_stats_cache" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_artists" ADD CONSTRAINT "release_artists_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_artists" ADD CONSTRAINT "release_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_genres" ADD CONSTRAINT "release_genres_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_genres" ADD CONSTRAINT "release_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tracks" ADD CONSTRAINT "release_tracks_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tracks" ADD CONSTRAINT "release_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_moods" ADD CONSTRAINT "entry_moods_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_moods" ADD CONSTRAINT "entry_moods_mood_id_moods_id_fk" FOREIGN KEY ("mood_id") REFERENCES "public"."moods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moods" ADD CONSTRAINT "moods_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_ratings" ADD CONSTRAINT "track_ratings_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_ratings" ADD CONSTRAINT "track_ratings_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_item_state" ADD CONSTRAINT "user_item_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_item_state" ADD CONSTRAINT "user_item_state_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_item_state" ADD CONSTRAINT "user_item_state_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_item_state" ADD CONSTRAINT "user_item_state_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_user_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_user_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_import_jobs" ADD CONSTRAINT "catalog_import_jobs_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats_cache" ADD CONSTRAINT "user_stats_cache_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_uidx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_lower_uidx" ON "profiles" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "push_tokens_user_idx" ON "push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_platform_external_uidx" ON "subscriptions" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "artists_name_trgm_idx" ON "artists" USING gin (lower(immutable_unaccent("name")) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "artists_name_fts_idx" ON "artists" USING gin (to_tsvector('simple', immutable_unaccent("name")));--> statement-breakpoint
CREATE INDEX "release_artists_artist_idx" ON "release_artists" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "release_genres_genre_idx" ON "release_genres" USING btree ("genre_id");--> statement-breakpoint
CREATE INDEX "release_tracks_track_idx" ON "release_tracks" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "releases_title_trgm_idx" ON "releases" USING gin (lower(immutable_unaccent("title")) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "releases_title_fts_idx" ON "releases" USING gin (to_tsvector('simple', immutable_unaccent("title")));--> statement-breakpoint
CREATE INDEX "releases_release_date_idx" ON "releases" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "track_artists_artist_idx" ON "track_artists" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "tracks_title_trgm_idx" ON "tracks" USING gin (lower(immutable_unaccent("title")) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "list_items_list_position_idx" ON "list_items" USING btree ("list_id","position");--> statement-breakpoint
CREATE INDEX "list_items_release_idx" ON "list_items" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "list_items_track_idx" ON "list_items" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "list_items_artist_idx" ON "list_items" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "lists_user_idx" ON "lists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reviews_user_idx" ON "reviews" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reviews_release_idx" ON "reviews" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "reviews_track_idx" ON "reviews" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "reviews_artist_idx" ON "reviews" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "entries_user_listened_idx" ON "entries" USING btree ("user_id","listened_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "entries_release_idx" ON "entries" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "entries_track_idx" ON "entries" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "entries_artist_idx" ON "entries" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "entry_moods_mood_idx" ON "entry_moods" USING btree ("mood_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moods_suggested_slug_uidx" ON "moods" USING btree ("slug") WHERE "moods"."owner_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "moods_owner_slug_uidx" ON "moods" USING btree ("owner_id","slug") WHERE "moods"."owner_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_item_state_release_uidx" ON "user_item_state" USING btree ("user_id","release_id") WHERE "user_item_state"."release_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_item_state_track_uidx" ON "user_item_state" USING btree ("user_id","track_id") WHERE "user_item_state"."track_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_item_state_artist_uidx" ON "user_item_state" USING btree ("user_id","artist_id") WHERE "user_item_state"."artist_id" is not null;--> statement-breakpoint
CREATE INDEX "user_item_state_release_idx" ON "user_item_state" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "user_item_state_track_idx" ON "user_item_state" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "user_item_state_artist_idx" ON "user_item_state" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "comments_review_idx" ON "comments" USING btree ("review_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_list_idx" ON "comments" USING btree ("list_id","created_at");--> statement-breakpoint
CREATE INDEX "follows_followee_idx" ON "follows" USING btree ("followee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "likes_user_review_uidx" ON "likes" USING btree ("user_id","review_id") WHERE "likes"."review_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "likes_user_list_uidx" ON "likes" USING btree ("user_id","list_id") WHERE "likes"."list_id" is not null;--> statement-breakpoint
CREATE INDEX "likes_review_idx" ON "likes" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "likes_list_idx" ON "likes" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_status_created_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "catalog_import_jobs_status_run_idx" ON "catalog_import_jobs" USING btree ("status","run_after");