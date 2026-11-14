ALTER TABLE "traveler_profiles" ADD COLUMN "group_pref" text DEFAULT 'mixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "traveler_profiles" ADD COLUMN "dream_destinations" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "traveler_profiles" ADD COLUMN "budget_band" text;--> statement-breakpoint
-- Map old travel styles to the 8 design styles (staging holds only TEST data; unknown values dropped).
CREATE FUNCTION pg_temp.tb_map_styles(old text[]) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_agg(DISTINCT m ORDER BY m), '{}')
  FROM unnest(old) s,
  LATERAL (SELECT CASE s
    WHEN 'trekking' THEN 'mountains' WHEN 'nature' THEN 'mountains'
    WHEN 'beach' THEN 'beach' WHEN 'wellness' THEN 'beach'
    WHEN 'city' THEN 'city' WHEN 'culture' THEN 'city' WHEN 'nightlife' THEN 'city'
    WHEN 'food' THEN 'food' WHEN 'photo' THEN 'photo'
    WHEN 'adventure' THEN 'extreme' WHEN 'budget' THEN 'budget'
  END AS m) x
  WHERE m IS NOT NULL
$$;--> statement-breakpoint
UPDATE "traveler_profiles" SET "travel_styles" = pg_temp.tb_map_styles("travel_styles");--> statement-breakpoint
UPDATE "trips" SET "travel_styles" = pg_temp.tb_map_styles("travel_styles");--> statement-breakpoint
UPDATE "travel_intents" SET "travel_styles" = pg_temp.tb_map_styles("travel_styles");--> statement-breakpoint
ALTER TABLE "traveler_profiles" ADD CONSTRAINT "traveler_profiles_group_pref_check" CHECK ("group_pref" IN ('mixed', 'women_only'));
