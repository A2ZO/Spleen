CREATE TABLE "user_listening_version" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"stats_version" integer DEFAULT 0 NOT NULL,
	"quick_client_id" uuid,
	"quick_seq" integer
);
--> statement-breakpoint
ALTER TABLE "user_stats_cache" ADD COLUMN "stats_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_listening_version" ADD CONSTRAINT "user_listening_version_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;