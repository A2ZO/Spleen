CREATE TYPE "public"."hidden_by" AS ENUM('moderation', 'suspension');--> statement-breakpoint
CREATE TYPE "public"."moderation_action_kind" AS ENUM('dismiss', 'resolve', 'hide', 'restore', 'delete', 'suspend', 'unsuspend');--> statement-breakpoint
CREATE TYPE "public"."moderation_subject" AS ENUM('member', 'review', 'list', 'comment', 'catalog');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'moderation';--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "moderation_action_kind" NOT NULL,
	"subject" "moderation_subject" NOT NULL,
	"reason" text NOT NULL,
	"report_reason" "report_reason",
	"moderator_id" uuid,
	"target_user_id" uuid,
	"review_id" uuid,
	"list_id" uuid,
	"comment_id" uuid,
	"report_id" uuid,
	"excerpt" text DEFAULT '' NOT NULL,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "hidden_by" "hidden_by";--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "hidden_by" "hidden_by";--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "hidden_by" "hidden_by";--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "moderation_action_id" uuid;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_id_user_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_actions_created_idx" ON "moderation_actions" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "moderation_actions_target_idx" ON "moderation_actions" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_anonymize_idx" ON "moderation_actions" USING btree ("created_at") WHERE "moderation_actions"."anonymized_at" is null;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_moderation_action_id_moderation_actions_id_fk" FOREIGN KEY ("moderation_action_id") REFERENCES "public"."moderation_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_hidden_pair" CHECK (("lists"."hidden_at" is null) = ("lists"."hidden_by" is null));--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_hidden_pair" CHECK (("reviews"."hidden_at" is null) = ("reviews"."hidden_by" is null));--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_hidden_pair" CHECK (("comments"."hidden_at" is null) = ("comments"."hidden_by" is null));