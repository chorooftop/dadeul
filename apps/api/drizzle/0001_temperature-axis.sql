CREATE TYPE "public"."vote_axis" AS ENUM('primary', 'temperature');--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "axis" "vote_axis" DEFAULT 'primary' NOT NULL;--> statement-breakpoint
ALTER TABLE "votes" DROP CONSTRAINT "votes_account_id_topic_id_pk";--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_account_id_topic_id_axis_pk" PRIMARY KEY("account_id","topic_id","axis");
