CREATE TABLE "creator_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"status" text DEFAULT 'joined' NOT NULL,
	"instagram" text,
	"reel_url" text,
	"posted_at" date,
	"views" integer,
	"views_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "creator_entries" ADD CONSTRAINT "creator_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_entries" ADD CONSTRAINT "creator_entries_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_entries_unique" ON "creator_entries" USING btree ("user_id","trip_id");--> statement-breakpoint
ALTER TABLE "creator_entries" ADD CONSTRAINT "creator_entries_status" CHECK ("status" in ('joined', 'tracking', 'approved', 'rejected', 'paid'));--> statement-breakpoint
ALTER TABLE "creator_entries" ADD CONSTRAINT "creator_entries_views" CHECK ("views" is null or "views" >= 0);
