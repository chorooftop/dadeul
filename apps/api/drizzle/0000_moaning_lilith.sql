CREATE TYPE "public"."credit_reason" AS ENUM('weather_vote', 'topic_vote_cost', 'ops_adjustment');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TYPE "public"."topic_kind" AS ENUM('weather', 'curated');--> statement-breakpoint
CREATE TYPE "public"."topic_status" AS ENUM('scheduled', 'active', 'closed');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_key" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"access_token_hash" text NOT NULL,
	"region_code" text,
	"credit_balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_device_key_unique" UNIQUE("device_key"),
	CONSTRAINT "accounts_access_token_hash_unique" UNIQUE("access_token_hash"),
	CONSTRAINT "accounts_credit_balance_nonneg" CHECK ("accounts"."credit_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" "credit_reason" NOT NULL,
	"ref_topic_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" "topic_kind" NOT NULL,
	"status" "topic_status" NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"regional" boolean NOT NULL,
	"credit_cost" integer DEFAULT 0 NOT NULL,
	"open_at" timestamp with time zone,
	"close_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"account_id" uuid NOT NULL,
	"topic_id" text NOT NULL,
	"option_value" text NOT NULL,
	"region_code" text,
	"cast_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_cast_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_account_id_topic_id_pk" PRIMARY KEY("account_id","topic_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_region_code_regions_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_ref_topic_id_topics_id_fk" FOREIGN KEY ("ref_topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_region_code_regions_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_daily_idx" ON "credit_ledger" USING btree ("account_id","reason","created_at");--> statement-breakpoint
CREATE INDEX "votes_tally_idx" ON "votes" USING btree ("topic_id","region_code","cast_at");