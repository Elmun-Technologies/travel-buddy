import "server-only";
import type { RoomEvent } from "@/modules/chat/service";
import { getSql } from "./db";

// One LISTEN connection per web process; events are fanned out to open room streams in memory.
type Cb = (e: RoomEvent) => void;
const g = globalThis as unknown as { roomSubs?: Map<string, Set<Cb>>; roomListen?: Promise<unknown> };
const subs = (g.roomSubs ??= new Map<string, Set<Cb>>());

function ensureListening() {
  g.roomListen ??= getSql()
    .listen("room_events", (payload) => {
      try {
        const e = JSON.parse(payload) as RoomEvent;
        subs.get(e.c)?.forEach((cb) => cb(e));
      } catch {
        // malformed payload: ignore
      }
    })
    .catch((e) => {
      console.error("room LISTEN failed", e);
      g.roomListen = undefined; // retry on the next subscriber
    });
}

export function subscribeRoom(conversationId: string, cb: Cb) {
  ensureListening();
  let set = subs.get(conversationId);
  if (!set) subs.set(conversationId, (set = new Set()));
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (!set!.size) subs.delete(conversationId);
  };
}
