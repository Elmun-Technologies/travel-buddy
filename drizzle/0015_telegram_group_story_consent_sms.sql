ALTER TABLE "trip_members" ADD COLUMN "story_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "tg_chat_id" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "tg_chat_title" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "tg_link_code" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "tg_link_expires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sms_consent" boolean DEFAULT false NOT NULL;