ALTER TABLE "trips" ADD COLUMN "public_code" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "date_precision" text DEFAULT 'exact' NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_public_code_unique" UNIQUE("public_code");--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_date_precision_check" CHECK ("date_precision" IN ('exact', 'month'));--> statement-breakpoint
-- Codes for existing trips (6 chars, no 0/O/1/I confusion is not needed for backfill: hex is fine).
UPDATE "trips" SET "public_code" = upper(substr(md5(id::text), 1, 6)) WHERE "public_code" IS NULL;
