import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { conversationMembers, conversations } from "@/db/schema";
import type { DbOrTx } from "@/lib/db";

// Phase 2 only keeps trip group membership in sync; messaging arrives in phase 4.

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
