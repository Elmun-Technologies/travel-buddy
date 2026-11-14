import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import { conversationMembers, conversations, messages, pollOptions, polls, pollVotes } from "@/db/schema";
import { type DbOrTx, getDb } from "@/lib/db";
import { getBlockedIds } from "@/modules/moderation/service";
import { getDisplayNames } from "@/modules/profiles/service";

export async function createTripConversation(tx: DbOrTx, tripId: string, organizerId: string) {
  const [c] = await tx
    .insert(conversations)
    .values({ kind: "trip_group", tripId })
    .returning({ id: conversations.id });
  await tx.insert(conversationMembers).values({ conversationId: c.id, userId: organizerId });
}

async function tripConversationId(tx: DbOrTx, tripId: string) {
  const [c] = await tx
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.tripId, tripId), eq(conversations.kind, "trip_group")));
  return c?.id;
}

export async function addTripChatMember(tx: DbOrTx, tripId: string, userId: string) {
  const id = await tripConversationId(tx, tripId);
  if (!id) return;
  await tx
    .insert(conversationMembers)
    .values({ conversationId: id, userId })
    .onConflictDoUpdate({
      target: [conversationMembers.conversationId, conversationMembers.userId],
      set: { leftAt: null },
    });
}

export async function removeTripChatMember(tx: DbOrTx, tripId: string, userId: string) {
  const id = await tripConversationId(tx, tripId);
  if (!id) return;
  await tx
    .update(conversationMembers)
    .set({ leftAt: new Date() })
    .where(
      and(
        eq(conversationMembers.conversationId, id),
        eq(conversationMembers.userId, userId),
        isNull(conversationMembers.leftAt),
      ),
    );
}

// ---------- trip room ----------

/** The trip's room for a current member, or null (non-members never read or write). */
export async function getRoom(userId: string, tripId: string) {
  const [r] = await getDb()
    .select({ id: conversations.id, pinnedText: conversations.pinnedText })
    .from(conversations)
    .innerJoin(conversationMembers, eq(conversationMembers.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.tripId, tripId),
        eq(conversations.kind, "trip_group"),
        eq(conversationMembers.userId, userId),
        isNull(conversationMembers.leftAt),
      ),
    );
  return r ?? null;
}

export async function roomMemberCount(conversationId: string) {
  const [r] = await getDb()
    .select({ n: count() })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.leftAt)));
  return r.n;
}

export type RoomEvent =
  | { t: "message"; c: string; id: string }
  | { t: "poll"; c: string; id: string }
  | { t: "pin"; c: string }
  | { t: "board"; c: string }; // plan / Yig'amiz / costs changed: pages refetch

/** Fan out to every open room page (src/lib/room-events.ts listens on this channel). */
export async function emit(tx: DbOrTx, e: RoomEvent) {
  await tx.execute(sql`select pg_notify('room_events', ${JSON.stringify(e)})`);
}

export type ChatMessage = {
  id: string;
  senderId: string | null;
  name: string;
  body: string;
  kind: string;
  pollId: string | null;
  at: string;
};

/** Newest 50 (or before a cursor), oldest first. Blocked people's messages are never shown. */
export async function listMessages(
  conversationId: string,
  viewerId: string,
  opts: { before?: string; ids?: string[] } = {},
) {
  const blocked = await getBlockedIds(viewerId);
  const rows = await getDb()
    .select({
      id: messages.id,
      senderId: messages.senderId,
      body: messages.body,
      kind: messages.kind,
      pollId: messages.pollId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        isNull(messages.hiddenAt),
        opts.ids ? inArray(messages.id, opts.ids) : undefined,
        opts.before ? lt(messages.createdAt, new Date(opts.before)) : undefined,
        blocked.length ? notInArray(messages.senderId, blocked) : undefined,
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(50);
  const names = await getDisplayNames([...new Set(rows.flatMap((r) => (r.senderId ? [r.senderId] : [])))]);
  return rows.reverse().map((r): ChatMessage => ({
    id: r.id,
    senderId: r.senderId,
    name: (r.senderId && names.get(r.senderId)) || "—",
    body: r.body,
    kind: r.kind,
    pollId: r.pollId,
    at: r.createdAt.toISOString(),
  }));
}

export async function sendMessage(conversationId: string, userId: string, body: string) {
  return getDb().transaction(async (tx) => {
    const [m] = await tx
      .insert(messages)
      .values({ conversationId, senderId: userId, body })
      .returning({ id: messages.id });
    await tx
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));
    await emit(tx, { t: "message", c: conversationId, id: m.id });
    return m.id;
  });
}

export async function setPinned(conversationId: string, text: string | null) {
  await getDb().transaction(async (tx) => {
    await tx
      .update(conversations)
      .set({ pinnedText: text, pinnedAt: text ? new Date() : null })
      .where(eq(conversations.id, conversationId));
    await emit(tx, { t: "pin", c: conversationId });
  });
}

export async function createPoll(
  conversationId: string,
  userId: string,
  question: string,
  options: string[],
) {
  return getDb().transaction(async (tx) => {
    const [p] = await tx
      .insert(polls)
      .values({ conversationId, createdBy: userId, question })
      .returning({ id: polls.id });
    await tx
      .insert(pollOptions)
      .values(options.map((label, position) => ({ pollId: p.id, label, position })));
    const [m] = await tx
      .insert(messages)
      .values({ conversationId, senderId: userId, body: question, kind: "poll", pollId: p.id })
      .returning({ id: messages.id });
    await tx
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));
    await emit(tx, { t: "message", c: conversationId, id: m.id });
    return p.id;
  });
}

/** Vote or change the vote. False if the option isn't in this room's poll. */
export async function vote(conversationId: string, pollId: string, optionId: string, userId: string) {
  return getDb().transaction(async (tx) => {
    const [ok] = await tx
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .innerJoin(polls, eq(polls.id, pollOptions.pollId))
      .where(
        and(
          eq(pollOptions.id, optionId),
          eq(polls.id, pollId),
          eq(polls.conversationId, conversationId),
          isNull(polls.closedAt),
        ),
      );
    if (!ok) return false;
    await tx
      .insert(pollVotes)
      .values({ pollId, optionId, userId })
      .onConflictDoUpdate({ target: [pollVotes.pollId, pollVotes.userId], set: { optionId } });
    await emit(tx, { t: "poll", c: conversationId, id: pollId });
    return true;
  });
}

export type PollView = {
  id: string;
  question: string;
  voters: number;
  mine: string | null;
  options: { id: string; label: string; votes: number }[];
};

export async function getPolls(conversationId: string, pollIds: string[], viewerId: string) {
  if (!pollIds.length) return {} as Record<string, PollView>;
  const db = getDb();
  const [ps, opts, votes] = await Promise.all([
    db
      .select({ id: polls.id, question: polls.question })
      .from(polls)
      .where(and(eq(polls.conversationId, conversationId), inArray(polls.id, pollIds))),
    db
      .select({ id: pollOptions.id, pollId: pollOptions.pollId, label: pollOptions.label })
      .from(pollOptions)
      .where(inArray(pollOptions.pollId, pollIds))
      .orderBy(asc(pollOptions.position)),
    db
      .select({ pollId: pollVotes.pollId, optionId: pollVotes.optionId, userId: pollVotes.userId })
      .from(pollVotes)
      .where(inArray(pollVotes.pollId, pollIds)),
  ]);
  const out: Record<string, PollView> = {};
  for (const p of ps) {
    const pv = votes.filter((v) => v.pollId === p.id);
    out[p.id] = {
      id: p.id,
      question: p.question,
      voters: pv.length,
      mine: pv.find((v) => v.userId === viewerId)?.optionId ?? null,
      options: opts
        .filter((o) => o.pollId === p.id)
        .map((o) => ({ id: o.id, label: o.label, votes: pv.filter((v) => v.optionId === o.id).length })),
    };
  }
  return out;
}
