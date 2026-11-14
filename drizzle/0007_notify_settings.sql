ALTER TABLE "conversation_members" ADD COLUMN "last_digest_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_off" text[] DEFAULT '{}'::text[] NOT NULL;