// Single Drizzle schema for the whole app. Modules access tables only via their own service.ts.
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const base = {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
const textArray = (name: string) =>
  text(name)
    .array()
    .notNull()
    .default(sql`'{}'::text[]`);

// ---------- enums ----------
export const userRole = pgEnum("user_role", ["traveler", "agency_member", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "suspended", "deleted"]);
export const authProvider = pgEnum("auth_provider", ["telegram", "google"]);
export const gender = pgEnum("gender", ["female", "male", "other"]);
export const tripKind = pgEnum("trip_kind", ["independent", "agency"]);
export const tripStatus = pgEnum("trip_status", ["draft", "open", "full", "closed", "completed", "hidden"]);
export const tripVisibility = pgEnum("trip_visibility", ["public", "unlisted"]);
export const tripMemberRole = pgEnum("trip_member_role", ["organizer", "member"]);
export const tripMemberStatus = pgEnum("trip_member_status", ["requested", "approved", "rejected", "left"]);
export const intentStatus = pgEnum("intent_status", ["active", "paused", "closed"]);
export const matchTargetType = pgEnum("match_target_type", ["user", "trip", "intent"]);
export const agencyStatus = pgEnum("agency_status", ["pending", "verified", "suspended"]);
export const verificationStatus = pgEnum("verification_status", ["pending", "approved", "rejected"]);
export const leadStatus = pgEnum("lead_status", ["new", "accepted", "rejected", "booked", "cancelled"]);
export const bookingStatus = pgEnum("booking_status", ["pending", "confirmed", "cancelled"]);
export const conversationKind = pgEnum("conversation_kind", ["direct", "trip_group", "lead"]);
export const reportTarget = pgEnum("report_target", ["user", "trip", "message", "agency"]);
export const reportStatus = pgEnum("report_status", ["open", "resolved", "dismissed"]);

// ---------- users & auth ----------
export const users = pgTable(
  "users",
  {
    ...base,
    role: userRole("role").notNull().default("traveler"),
    status: userStatus("status").notNull().default("active"),
    locale: text("locale").notNull().default("uz"),
    // Never exposed publicly; set only via Telegram request_contact.
    phone: text("phone"),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    email: text("email"),
    deletedAt: ts("deleted_at"),
    // Bot notification kinds the user turned off: pin | poll | chat | mine.
    notifyOff: textArray("notify_off"),
  },
  // One verified phone = one account (anti-abuse).
  (t) => [
    uniqueIndex("users_verified_phone")
      .on(t.phone)
      .where(sql`${t.phoneVerified}`),
  ],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    ...base,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: authProvider("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
  },
  (t) => [uniqueIndex("auth_accounts_provider_uid").on(t.provider, t.providerUserId)],
);

export const sessions = pgTable(
  "sessions",
  {
    ...base,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // SHA-256 of the cookie token; raw token never stored.
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

export const travelerProfiles = pgTable("traveler_profiles", {
  ...base,
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  birthDate: date("birth_date").notNull(),
  gender: gender("gender"),
  showGender: boolean("show_gender").notNull().default(false),
  city: text("city"),
  country: text("country"), // ISO 3166-1 alpha-2
  languages: textArray("languages"),
  bio: text("bio"),
  avatarKey: text("avatar_key"),
  travelStyles: textArray("travel_styles"),
  interests: textArray("interests"),
  groupPref: text("group_pref").notNull().default("mixed"), // mixed | women_only (women only, enforced in schema)
  dreamDestinations: textArray("dream_destinations"), // ISO country codes, for matching
  budgetBand: text("budget_band"), // lt300 | 300_600 | 600_1000 | any
  telegramVerified: boolean("telegram_verified").notNull().default(false),
  idVerified: boolean("id_verified").notNull().default(false),
});

// Unfinished onboarding, saved on every change so nothing is lost if the Mini App closes. Deleted on submit.
export const onboardingDrafts = pgTable("onboarding_drafts", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const idVerifications = pgTable("id_verifications", {
  ...base,
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: verificationStatus("status").notNull().default("pending"),
  // Private bucket keys; nulled after files are purged (30 days after decision).
  documentKey: text("document_key"),
  selfieKey: text("selfie_key"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: ts("reviewed_at"),
  filesPurgedAt: ts("files_purged_at"),
});

// ---------- agencies ----------
export const agencies = pgTable("agencies", {
  ...base,
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  legalName: text("legal_name"),
  taxId: text("tax_id"),
  phone: text("phone"),
  website: text("website"),
  description: text("description"),
  logoKey: text("logo_key"),
  country: text("country"),
  city: text("city"),
  status: agencyStatus("status").notNull().default("pending"),
});

export const agencyMembers = pgTable(
  "agency_members",
  {
    ...base,
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // owner | member
  },
  (t) => [uniqueIndex("agency_members_unique").on(t.agencyId, t.userId)],
);

export const agencyVerifications = pgTable("agency_verifications", {
  ...base,
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  documentKeys: textArray("document_keys"),
  status: verificationStatus("status").notNull().default("pending"),
  note: text("note"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: ts("reviewed_at"),
});

// ---------- trips ----------
export const trips = pgTable(
  "trips",
  {
    ...base,
    kind: tripKind("kind").notNull(),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    agencyId: uuid("agency_id").references(() => agencies.id),
    title: text("title").notNull(),
    destinationCountry: text("destination_country").notNull(),
    destinationCity: text("destination_city"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    dateFlexDays: integer("date_flex_days").notNull().default(0),
    budgetMin: integer("budget_min"), // minor units
    budgetMax: integer("budget_max"),
    currency: text("currency").notNull().default("USD"),
    travelStyles: textArray("travel_styles"),
    groupSizeMax: integer("group_size_max"),
    ageMin: integer("age_min"),
    ageMax: integer("age_max"),
    womenOnly: boolean("women_only").notNull().default(false),
    accommodationPref: text("accommodation_pref"),
    description: text("description"),
    status: tripStatus("status").notNull().default("draft"),
    visibility: tripVisibility("visibility").notNull().default("public"),
    isTest: boolean("is_test").notNull().default(false),
    // Short code for share links: t.me/<bot>?startapp=trip_<code>, /{locale}/t/<code>.
    publicCode: text("public_code").unique(),
    // "exact": real dates; "month": "Shu oy / Keyingi oy" — the group agrees on days later.
    datePrecision: text("date_precision").notNull().default("exact"),
    // Yig'amiz: everyone marks "Oldim" before this day (set by the organizer).
    ticketDeadline: date("ticket_deadline"),
  },
  (t) => [index("trips_dest_start_status").on(t.destinationCountry, t.startDate, t.status)],
);

export const tripMembers = pgTable(
  "trip_members",
  {
    ...base,
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: tripMemberRole("role").notNull().default("member"),
    status: tripMemberStatus("status").notNull().default("requested"),
    message: text("message"),
  },
  (t) => [uniqueIndex("trip_members_unique").on(t.tripId, t.userId)],
);

export const travelIntents = pgTable(
  "travel_intents",
  {
    ...base,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    destinationCountry: text("destination_country").notNull(),
    destinationCity: text("destination_city"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    dateFlexDays: integer("date_flex_days").notNull().default(0),
    budgetMin: integer("budget_min"),
    budgetMax: integer("budget_max"),
    currency: text("currency").notNull().default("USD"),
    travelStyles: textArray("travel_styles"),
    note: text("note"),
    status: intentStatus("status").notNull().default("active"),
  },
  (t) => [index("intents_dest_start").on(t.destinationCountry, t.startDate)],
);

export const matchSuggestions = pgTable(
  "match_suggestions",
  {
    ...base,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: matchTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    score: real("score").notNull(),
    reasons: jsonb("reasons")
      .notNull()
      .default(sql`'[]'::jsonb`),
    shownAt: ts("shown_at"),
    action: text("action"), // dismissed | contacted | joined
  },
  (t) => [
    index("match_user_score").on(t.userId, t.score.desc()),
    uniqueIndex("match_unique").on(t.userId, t.targetType, t.targetId),
  ],
);

// ---------- agency offers, leads, bookings ----------
export const tourOffers = pgTable("tour_offers", {
  ...base,
  tripId: uuid("trip_id")
    .notNull()
    .unique()
    .references(() => trips.id, { onDelete: "cascade" }),
  agencyId: uuid("agency_id")
    .notNull()
    .references(() => agencies.id),
  price: integer("price").notNull(), // minor units per person
  currency: text("currency").notNull().default("USD"),
  includes: textArray("includes"),
  excludes: textArray("excludes"),
  itinerary: jsonb("itinerary")
    .notNull()
    .default(sql`'[]'::jsonb`),
  refundPolicy: text("refund_policy"),
  seatsTotal: integer("seats_total").notNull(),
  seatsAvailable: integer("seats_available").notNull(),
  views: integer("views").notNull().default(0),
});

export const leads = pgTable(
  "leads",
  {
    ...base,
    tourOfferId: uuid("tour_offer_id")
      .notNull()
      .references(() => tourOffers.id),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    message: text("message"),
    people: integer("people").notNull().default(1),
    status: leadStatus("status").notNull().default("new"),
    acceptedAt: ts("accepted_at"),
    rejectedAt: ts("rejected_at"),
    bookedAt: ts("booked_at"),
    cancelledAt: ts("cancelled_at"),
  },
  (t) => [index("leads_agency_status").on(t.agencyId, t.status)],
);

export const bookings = pgTable("bookings", {
  ...base,
  leadId: uuid("lead_id")
    .notNull()
    .unique()
    .references(() => leads.id),
  people: integer("people").notNull(),
  amount: integer("amount").notNull(), // minor units, total
  currency: text("currency").notNull().default("USD"),
  status: bookingStatus("status").notNull().default("pending"),
  confirmedAt: ts("confirmed_at"),
});

// ---------- chat ----------
export const conversations = pgTable("conversations", {
  ...base,
  kind: conversationKind("kind").notNull(),
  tripId: uuid("trip_id").references(() => trips.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  lastMessageAt: ts("last_message_at"),
  // Organizer's announcement pinned on top of the room chat ("E'LON · Uchrashuv: 06:00, aeroport").
  pinnedText: text("pinned_text"),
  pinnedAt: ts("pinned_at"),
});

export const conversationMembers = pgTable(
  "conversation_members",
  {
    ...base,
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: ts("last_read_at"),
    // "Guruhda N ta yangi xabar" goes at most once an hour.
    lastDigestAt: ts("last_digest_at"),
    leftAt: ts("left_at"),
  },
  (t) => [uniqueIndex("conv_members_unique").on(t.conversationId, t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    ...base,
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    kind: text("kind").notNull().default("text"), // text | poll
    pollId: uuid("poll_id"),
    hiddenAt: ts("hidden_at"),
  },
  (t) => [index("messages_conv_created").on(t.conversationId, t.createdAt)],
);

// Polls live inside the room chat (one vote per person; changing the vote is allowed).
export const polls = pgTable("polls", {
  ...base,
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  question: text("question").notNull(),
  closedAt: ts("closed_at"),
});

export const pollOptions = pgTable("poll_options", {
  ...base,
  pollId: uuid("poll_id")
    .notNull()
    .references(() => polls.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  position: integer("position").notNull(),
});

export const pollVotes = pgTable(
  "poll_votes",
  {
    ...base,
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("poll_votes_one").on(t.pollId, t.userId)],
);

// ---------- trip room board: plan, checklist, Yig'amiz, costs ----------

const tripRef = () =>
  uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" });
const userRef = (name: string) =>
  uuid(name)
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

/** Day-by-day plan. Organizer's items are final; members' are proposals until accepted. */
export const planItems = pgTable(
  "plan_items",
  {
    ...base,
    tripId: tripRef(),
    day: integer("day").notNull(),
    place: text("place").notNull(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    proposed: boolean("proposed").notNull().default(false),
  },
  (t) => [index("plan_items_trip").on(t.tripId, t.day)],
);

/** Each member's own checklist. Labels "k:<key>" are default items translated in the UI. */
export const checklistItems = pgTable(
  "checklist_items",
  {
    ...base,
    tripId: tripRef(),
    userId: userRef("user_id"),
    label: text("label").notNull(),
    done: boolean("done").notNull().default(false),
  },
  (t) => [uniqueIndex("checklist_items_unique").on(t.tripId, t.userId, t.label)],
);

/** Options the group votes on: flight, stay, or a partner agency offer (entered by admin). */
export const tripOptions = pgTable(
  "trip_options",
  {
    ...base,
    tripId: tripRef(),
    kind: text("kind").notNull(), // flight | stay | offer
    title: text("title").notNull(),
    detail: text("detail"),
    priceMinor: integer("price_minor"), // flight: per person; stay: per night; offer: per person
    nights: integer("nights"),
    url: text("url"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    bookedBy: uuid("booked_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("trip_options_trip").on(t.tripId, t.kind)],
);

/** One vote per person per kind (flight / stay / offer) in a trip. */
export const optionVotes = pgTable(
  "option_votes",
  {
    ...base,
    tripId: tripRef(),
    kind: text("kind").notNull(),
    optionId: uuid("option_id")
      .notNull()
      .references(() => tripOptions.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
  },
  (t) => [uniqueIndex("option_votes_one").on(t.tripId, t.kind, t.userId)],
);

/** "Oldim": the member bought their ticket. */
export const tripTickets = pgTable(
  "trip_tickets",
  { ...base, tripId: tripRef(), userId: userRef("user_id") },
  (t) => [uniqueIndex("trip_tickets_unique").on(t.tripId, t.userId)],
);

/** Bookkeeping only: money never passes through the platform. Split equally among splitAmong. */
export const expenses = pgTable(
  "expenses",
  {
    ...base,
    tripId: tripRef(),
    paidBy: userRef("paid_by"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    category: text("category").notNull(), // stay | transport | food | other
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("USD"),
    splitAmong: uuid("split_among").array().notNull(),
    optionId: uuid("option_id").references(() => tripOptions.id, { onDelete: "set null" }),
  },
  (t) => [index("expenses_trip").on(t.tripId)],
);

/** "To'ladim": a repayment between two members. */
export const settlements = pgTable(
  "settlements",
  {
    ...base,
    tripId: tripRef(),
    fromUser: userRef("from_user"),
    toUser: userRef("to_user"),
    amountMinor: integer("amount_minor").notNull(),
  },
  (t) => [index("settlements_trip").on(t.tripId)],
);

/** "Tayyor tur so'raymiz": handled by hand in MVP — admin collects partner offers into trip_options. */
export const agencyRequests = pgTable(
  "agency_requests",
  {
    ...base,
    tripId: tripRef(),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    people: integer("people").notNull(),
    status: text("status").notNull().default("new"), // new | sent | answered | closed
  },
  (t) => [uniqueIndex("agency_requests_trip").on(t.tripId)],
);

/** "N/N safarga bordi": one outcome per person per trip (went / no_show), written by the worker. */
export const reliability = pgTable(
  "reliability",
  {
    ...base,
    userId: userRef("user_id"),
    tripId: tripRef(),
    outcome: text("outcome").notNull(), // went | no_show
  },
  (t) => [uniqueIndex("reliability_unique").on(t.userId, t.tripId)],
);

// ---------- trust & safety ----------
export const reviews = pgTable(
  "reviews",
  {
    ...base,
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    subjectUserId: uuid("subject_user_id").references(() => users.id),
    subjectAgencyId: uuid("subject_agency_id").references(() => agencies.id),
    rating: integer("rating").notNull(), // 1..5
    body: text("body"),
    hiddenAt: ts("hidden_at"),
  },
  (t) => [index("reviews_subject_user").on(t.subjectUserId)],
);

export const reports = pgTable(
  "reports",
  {
    ...base,
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    targetType: reportTarget("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    status: reportStatus("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [index("reports_status").on(t.status, t.createdAt)],
);

export const blocks = pgTable(
  "blocks",
  {
    ...base,
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("blocks_unique").on(t.blockerId, t.blockedId), index("blocks_blocked").on(t.blockedId)],
);

export const notifications = pgTable(
  "notifications",
  {
    ...base,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload")
      .notNull()
      .default(sql`'{}'::jsonb`),
    channel: text("channel").notNull().default("in_app"), // in_app | telegram | email
    sentAt: ts("sent_at"),
    readAt: ts("read_at"),
  },
  (t) => [index("notifications_user").on(t.userId, t.createdAt)],
);

// Post-MVP billing; intentionally unused for now.
export const subscriptions = pgTable("subscriptions", {
  ...base,
  agencyId: uuid("agency_id").references(() => agencies.id),
  userId: uuid("user_id").references(() => users.id),
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  currentPeriodEnd: ts("current_period_end"),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    ...base,
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    meta: jsonb("meta")
      .notNull()
      .default(sql`'{}'::jsonb`),
    ip: text("ip"),
  },
  (t) => [index("audit_created").on(t.createdAt)],
);

// Postgres-based rate limiting (no Redis): one row per key+window.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(), // e.g. "waitlist:ip:1.2.3.4:2026-11-14T10"
  count: integer("count").notNull().default(0),
  expiresAt: ts("expires_at").notNull(),
});

// ---------- landing ----------
export const waitlist = pgTable("waitlist", {
  ...base,
  // Normalized: lowercase email or "@telegram_username".
  contact: text("contact").notNull().unique(),
  contactType: text("contact_type").notNull(), // email | telegram
  destinations: textArray("destinations"),
  locale: text("locale").notNull(),
  source: text("source"), // utm_source
  isTest: boolean("is_test").notNull().default(false),
});
