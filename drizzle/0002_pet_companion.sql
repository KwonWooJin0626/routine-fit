CREATE TABLE "pet_companions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"payload" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pet_companions" ADD CONSTRAINT "pet_companions_user_id_user_states_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_states"("user_id") ON DELETE cascade ON UPDATE no action;