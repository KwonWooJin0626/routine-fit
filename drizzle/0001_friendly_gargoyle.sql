CREATE TABLE "sleep_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"revision" integer NOT NULL,
	"session_date" text NOT NULL,
	"kind" text NOT NULL,
	"planned_at" text NOT NULL,
	"status" text NOT NULL,
	"attempted_at" text NOT NULL,
	"provider_id" text
);
--> statement-breakpoint
CREATE TABLE "sleep_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"settings" text NOT NULL,
	"email" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sleep_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_date" text NOT NULL,
	"kind" text NOT NULL,
	"planned_at" text NOT NULL,
	"checked_at" text NOT NULL,
	"actual_at" text,
	"method" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sleep_deliveries" ADD CONSTRAINT "sleep_deliveries_user_id_sleep_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sleep_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_profiles" ADD CONSTRAINT "sleep_profiles_user_id_user_states_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_states"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_records" ADD CONSTRAINT "sleep_records_user_id_sleep_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sleep_profiles"("user_id") ON DELETE cascade ON UPDATE no action;