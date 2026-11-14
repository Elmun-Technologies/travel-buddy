CREATE TABLE "reliability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"outcome" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reliability" ADD CONSTRAINT "reliability_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reliability" ADD CONSTRAINT "reliability_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reliability_unique" ON "reliability" USING btree ("user_id","trip_id");--> statement-breakpoint
ALTER TABLE "reliability" ADD CONSTRAINT "reliability_outcome_check" CHECK ("outcome" IN ('went', 'no_show'));
