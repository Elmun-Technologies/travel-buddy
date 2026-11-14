CREATE TABLE "agency_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trip_id" uuid NOT NULL,
	"requested_by" uuid,
	"people" integer NOT NULL,
	"status" text DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trip_id" uuid NOT NULL,
	"paid_by" uuid NOT NULL,
	"created_by" uuid,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"split_among" uuid[] NOT NULL,
	"option_id" uuid
);
--> statement-breakpoint
CREATE TABLE "option_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trip_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trip_id" uuid NOT NULL,
	"day" integer NOT NULL,
	"place" text NOT NULL,
	"note" text,
	"created_by" uuid,
	"proposed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trip_id" uuid NOT NULL,
	"from_user" uuid NOT NULL,
	"to_user" uuid NOT NULL,
	"amount_minor" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trip_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"price_minor" integer,
	"nights" integer,
	"url" text,
	"created_by" uuid,
	"booked_by" uuid
);
--> statement-breakpoint
CREATE TABLE "trip_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "ticket_deadline" date;--> statement-breakpoint
ALTER TABLE "agency_requests" ADD CONSTRAINT "agency_requests_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_requests" ADD CONSTRAINT "agency_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_option_id_trip_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."trip_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_votes" ADD CONSTRAINT "option_votes_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_votes" ADD CONSTRAINT "option_votes_option_id_trip_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."trip_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_votes" ADD CONSTRAINT "option_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_user_users_id_fk" FOREIGN KEY ("from_user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_user_users_id_fk" FOREIGN KEY ("to_user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_options" ADD CONSTRAINT "trip_options_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_options" ADD CONSTRAINT "trip_options_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_options" ADD CONSTRAINT "trip_options_booked_by_users_id_fk" FOREIGN KEY ("booked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_tickets" ADD CONSTRAINT "trip_tickets_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_tickets" ADD CONSTRAINT "trip_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agency_requests_trip" ON "agency_requests" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_items_unique" ON "checklist_items" USING btree ("trip_id","user_id","label");--> statement-breakpoint
CREATE INDEX "expenses_trip" ON "expenses" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "option_votes_one" ON "option_votes" USING btree ("trip_id","kind","user_id");--> statement-breakpoint
CREATE INDEX "plan_items_trip" ON "plan_items" USING btree ("trip_id","day");--> statement-breakpoint
CREATE INDEX "settlements_trip" ON "settlements" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_options_trip" ON "trip_options" USING btree ("trip_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_tickets_unique" ON "trip_tickets" USING btree ("trip_id","user_id");--> statement-breakpoint
ALTER TABLE "trip_options" ADD CONSTRAINT "trip_options_kind_check" CHECK ("kind" IN ('flight', 'stay', 'offer'));--> statement-breakpoint
ALTER TABLE "option_votes" ADD CONSTRAINT "option_votes_kind_check" CHECK ("kind" IN ('flight', 'stay', 'offer'));--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_check" CHECK ("category" IN ('stay', 'transport', 'food', 'other'));--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_check" CHECK ("amount_minor" > 0);--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_amount_check" CHECK ("amount_minor" > 0);
