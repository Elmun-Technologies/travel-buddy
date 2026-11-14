CREATE TABLE "price_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"destination" text NOT NULL,
	"days" integer NOT NULL,
	"room_type" text NOT NULL,
	"p25" integer NOT NULL,
	"median" integer NOT NULL,
	"p75" integer NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"rating" real,
	"price_minor" integer,
	"note" text,
	"contact_url" text,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"passport_country" text DEFAULT 'UZ' NOT NULL,
	"destination" text NOT NULL,
	"status" text NOT NULL,
	"max_stay_days" integer,
	"visa_name" text,
	"documents" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"checked_at" date NOT NULL,
	"source_url" text,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "price_stats_key" ON "price_stats" USING btree ("destination","days","room_type");--> statement-breakpoint
CREATE UNIQUE INDEX "visa_rules_pair" ON "visa_rules" USING btree ("passport_country","destination");--> statement-breakpoint
ALTER TABLE "visa_rules" ADD CONSTRAINT "visa_rules_status_check" CHECK ("status" IN ('visa_free', 'evisa', 'visa_required'));--> statement-breakpoint
ALTER TABLE "price_stats" ADD CONSTRAINT "price_stats_room_check" CHECK ("room_type" IN ('quad', 'double', 'single'));
