import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import { conversationMembers, conversations, messages, pollOptions, polls, pollVotes } from "@/db/schema";
import { queueGroupPost, shareLink } from "@/modules/telegram-group/service";
import { sharedApprovedTrip } from "@/modules/groups/service";
import { isActiveUser } from "@/modules/users/service";
import { type DbOrTx, getDb } from "@/lib/db";
import { getBlockedIds } from "@/modules/moderation/service";
import { notifyRoom } from "@/modules/notifications/service";
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

async function tripOf(tx: DbOrTx, conversationId: string) {
  const [c] = await tx
    .select({ tripId: conversations.tripId })
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  return c?.tripId ?? "";
}

/** The member has seen the room up to now (page open / live stream alive): no chat digest for it. */
export async function markRead(conversationId: string, userId: string) {
  await getDb()
    .update(conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(
      and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)),
    );
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

/** A picture message. The caption is optional; the file lives in storage under `key`. */
export async function sendImage(conversationId: string, userId: string, key: string, caption: string) {
  return getDb().transaction(async (tx) => {
    const [m] = await tx
      .insert(messages)
      .values({ conversationId, senderId: userId, body: caption, kind: "image", imageKey: key })
      .returning({ id: messages.id });
    await tx
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));
    await emit(tx, { t: "message", c: conversationId, id: m.id });
    return m.id;
  });
}

/** Storage key of a picture message, if this person may see it (current member, not blocked, not hidden). */
export async function messageImageKey(viewerId: string, messageId: string) {
  const [m] = await getDb()
    .select({ key: messages.imageKey, sender: messages.senderId, conv: messages.conversationId })
    .from(messages)
    .innerJoin(
      conversationMembers,
      and(
        eq(conversationMembers.conversationId, messages.conversationId),
        eq(conversationMembers.userId, viewerId),
        isNull(conversationMembers.leftAt),
      ),
    )
    .where(and(eq(messages.id, messageId), isNull(messages.hiddenAt), eq(messages.kind, "image")));
  if (!m?.key) return null;
  if (m.sender && m.sender !== viewerId && (await getBlockedIds(viewerId)).includes(m.sender)) return null;
  if (!(await isActiveUser(viewerId))) return null;
  return m.key;
}

export async function setPinned(conversationId: string, text: string | null, byUserId: string) {
  await getDb().transaction(async (tx) => {
    if (text) {
      const tripId = await tripOf(tx, conversationId);
      await notifyRoom(tx, conversationId, byUserId, "room_pin", { tripId, text });
      await queueGroupPost(tx, tripId, "pin", text, await shareLink(tx, tripId));
    }
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
    const pollTrip = await tripOf(tx, conversationId);
    await notifyRoom(tx, conversationId, userId, "room_poll", { tripId: pollTrip, text: question });
    await queueGroupPost(tx, pollTrip, "poll", question, await shareLink(tx, pollTrip));
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

// ---------- direct chats (1:1) ----------

export type DirectAllowed = "ok" | "blocked" | "no_shared_trip" | "inactive" | "self";

/** Two people may write to each other after being in one approved group, never across a block. */
export async function canChat(a: string, b: string): Promise<DirectAllowed> {
  if (a === b) return "self";
  if (!(await isActiveUser(a)) || !(await isActiveUser(b))) return "inactive";
  if ((await getBlockedIds(a)).includes(b)) return "blocked";
  if (!(await sharedApprovedTrip(a, b))) return "no_shared_trip";
  return "ok";
}

const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** The one conversation of this pair; created on first use. */
export async function openDirect(userId: string, otherId: string) {
  const allowed = await canChat(userId, otherId);
  if (allowed !== "ok") return { ok: false as const, error: allowed };
  const key = pairKey(userId, otherId);
  const id = await getDb().transaction(async (tx) => {
    const [found] = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.directKey, key));
    if (found) {
      await tx
        .update(conversationMembers)
        .set({ leftAt: null })
        .where(and(eq(conversationMembers.conversationId, found.id), eq(conversationMembers.userId, userId)));
      return found.id;
    }
    const [c] = await tx
      .insert(conversations)
      .values({ kind: "direct", directKey: key })
      .onConflictDoNothing()
      .returning({ id: conversations.id });
    const convId =
      c?.id ??
      (
        await tx.select({ id: conversations.id }).from(conversations).where(eq(conversations.directKey, key))
      )[0].id;
    await tx
      .insert(conversationMembers)
      .values([
        { conversationId: convId, userId },
        { conversationId: convId, userId: otherId },
      ])
      .onConflictDoNothing();
    return convId;
  });
  return { ok: true as const, id };
}

/**
 * A 1:1 or lead conversation as seen by one member: who the other side is and whether writing is allowed.
 * Null if the person is not a member.
 */
export async function getChat(userId: string, conversationId: string) {
  const [c] = await getDb()
    .select({
      id: conversations.id,
      kind: conversations.kind,
      directKey: conversations.directKey,
      leadId: conversations.leadId,
    })
    .from(conversations)
    .innerJoin(conversationMembers, eq(conversationMembers.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.id, conversationId),
        inArray(conversations.kind, ["direct", "lead"]),
        eq(conversationMembers.userId, userId),
        isNull(conversationMembers.leftAt),
      ),
    );
  if (!c) return null;
  const others = (
    await getDb()
      .select({ id: conversationMembers.userId })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.leftAt)))
  )
    .map((r) => r.id)
    .filter((id) => id !== userId);
  const [other] = others;
  let canWrite = true;
  if (c.kind === "direct") canWrite = !!other && (await canChat(userId, other)) === "ok";
  return { ...c, otherId: other ?? null, canWrite };
}

/** My direct chats, newest first, with the other person's name and whether something is unread. */
export async function listDirect(userId: string) {
  const rows = await getDb().execute<{
    id: string;
    other_id: string;
    last_at: Date | null;
    unread: boolean;
    preview: string | null;
    kind: string;
  }>(sql`
    select c.id, c.kind,
      (select o.user_id from conversation_members o
         where o.conversation_id = c.id and o.user_id <> ${userId} and o.left_at is null
         order by o.created_at, o.id limit 1) as other_id,
      c.last_message_at as last_at,
      (c.last_message_at is not null and (me.last_read_at is null or me.last_read_at < c.last_message_at)) as unread,
      (select case when m.kind = 'image' then '' else left(m.body, 80) end
         from messages m where m.conversation_id = c.id and m.hidden_at is null order by m.created_at desc limit 1) as preview
    from conversations c
    join conversation_members me on me.conversation_id = c.id and me.user_id = ${userId} and me.left_at is null
    where c.kind in ('direct', 'lead')
    order by c.last_message_at desc nulls last
    limit 50`);
  const blocked = new Set(await getBlockedIds(userId));
  const visible = rows.filter((r) => r.other_id && !blocked.has(r.other_id));
  const names = await getDisplayNames(visible.map((r) => r.other_id));
  return visible.map((r) => ({
    id: r.id,
    kind: r.kind,
    otherId: r.other_id,
    name: names.get(r.other_id) ?? "—",
    lastAt: r.last_at ? new Date(r.last_at).toISOString() : null,
    unread: r.unread,
    preview: r.preview ?? "",
  }));
}

/** One short "X wrote to you" per conversation per 10 minutes, so a busy chat is not a stream of pings. */
export async function notifyDirect(conversationId: string, senderId: string) {
  await getDb().execute(sql`
    insert into notifications (user_id, type, payload, channel)
    select cm.user_id, 'dm', jsonb_build_object('convId', ${conversationId}::text, 'memberId', ${senderId}::text), 'telegram'
    from conversation_members cm
    where cm.conversation_id = ${conversationId} and cm.user_id <> ${senderId} and cm.left_at is null
      and (cm.last_read_at is null or cm.last_read_at < now() - interval '1 minute')
      and not exists (select 1 from notifications n
        where n.user_id = cm.user_id and n.type = 'dm' and n.payload->>'convId' = ${conversationId}::text
          and n.created_at > now() - interval '10 minutes')
      and not exists (select 1 from blocks b
        where (b.blocker_id = cm.user_id and b.blocked_id = ${senderId})
           or (b.blocker_id = ${senderId} and b.blocked_id = cm.user_id))`);
}
