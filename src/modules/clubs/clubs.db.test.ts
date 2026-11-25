// Integration test against a real Postgres (runs when DATABASE_URL is set).
import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { clubs, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loginWithTelegram, verifyPhoneFromTelegram } from "@/modules/auth/service";
import { saveProfile } from "@/modules/profiles/service";
import {
  addPost,
  createClub,
  decideClubRequest,
  getClub,
  isClubOrganizer,
  joinClub,
  leaveClub,
  listClubs,
  removePost,
  setClubStatus,
} from "./service";

const run = !!process.env.DATABASE_URL;
const base = Math.floor(Math.random() * 1e9) + 1.3e10;
const created: string[] = [];

async function newUser(n: number, phone = true) {
  const res = await loginWithTelegram({ id: base + n, first_name: `T${n}` }, "uz");
  if (!res.ok) throw new Error("login failed");
  created.push(res.userId);
  await saveProfile(res.userId, {
    displayName: `TEST club ${n}`,
    birthDate: "1998-03-01",
    gender: "male",
    showGender: false,
    city: null,
    country: "UZ",
    languages: ["uz"],
    travelStyles: [],
    interests: [],
    bio: null,
  });
  if (phone)
    expect(await verifyPhoneFromTelegram(base + n, `+99897${String(base + n).slice(-7)}`)).toBe("ok");
  return res.userId;
}
const input = (name: string, privacy: "open" | "closed" = "open") => ({
  name,
  description: "d",
  rules: null,
  city: null,
  privacy,
});

describe.runIf(run)("clubs (db)", () => {
  afterAll(async () => {
    await getDb().delete(clubs).where(inArray(clubs.ownerUserId, created));
    await getDb().delete(users).where(inArray(users.id, created));
  });

  it("needs a verified phone, at most 3 clubs each; open clubs admit at once, closed ones on approval", async () => {
    const [owner, joiner, nophone, outsider] = [
      await newUser(1),
      await newUser(2),
      await newUser(3, false),
      await newUser(4),
    ];
    expect(await createClub(nophone, input("TEST no phone"))).toEqual({ ok: false, error: "phone_required" });
    const open = await createClub(owner, input("TEST open club"));
    const closed = await createClub(owner, input("TEST closed club", "closed"));
    if (!open.ok || !closed.ok) throw new Error("create");
    expect((await createClub(owner, input("TEST third"))).ok).toBe(true);
    expect(await createClub(owner, input("TEST fourth"))).toEqual({ ok: false, error: "too_many" });
    expect(await isClubOrganizer(owner, open.id)).toBe(true);
    expect(await isClubOrganizer(joiner, open.id)).toBe(false);

    expect(await joinClub(joiner, open.id)).toEqual({ ok: true });
    expect(await joinClub(joiner, open.id)).toEqual({ ok: false, error: "already" });
    expect((await getClub(joiner, open.id))?.isMember).toBe(true);

    // closed: a request first; the organizer decides; non-organizers cannot
    expect(await joinClub(joiner, closed.id)).toEqual({ ok: true });
    expect((await getClub(joiner, closed.id))?.myStatus).toBe("requested");
    expect((await getClub(joiner, closed.id))?.posts).toEqual([]);
    expect(await decideClubRequest(outsider, closed.id, joiner, true)).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect((await getClub(owner, closed.id))?.requests.map((r) => r.userId)).toEqual([joiner]);
    expect(await decideClubRequest(owner, closed.id, joiner, true)).toEqual({ ok: true });
    expect((await getClub(joiner, closed.id))?.isMember).toBe(true);
    expect((await getClub(joiner, closed.id))?.memberCount).toBe(2);

    // posts: members write; outsiders cannot; author or organizer removes; an outsider sees open-club posts
    expect(await addPost(outsider, open.id, "hello")).toEqual({ ok: false, error: "forbidden" });
    expect(await addPost(joiner, open.id, "Yangi safar bor")).toEqual({ ok: true });
    const posts = (await getClub(outsider, open.id))!.posts;
    expect(posts.map((p) => p.body)).toEqual(["Yangi safar bor"]);
    expect(await removePost(outsider, open.id, posts[0].id)).toEqual({ ok: false, error: "forbidden" });
    expect(await removePost(owner, open.id, posts[0].id)).toEqual({ ok: true });

    // leaving; organizers cannot leave; hidden clubs vanish
    expect(await leaveClub(joiner, open.id)).toEqual({ ok: true });
    expect(await leaveClub(owner, open.id)).toEqual({ ok: false, error: "forbidden" });
    const row = (await listClubs(outsider)).find((c) => c.id === closed.id);
    expect(row?.members).toBe(2); // the organizer and the approved joiner
    expect((await listClubs(outsider)).some((c) => c.id === open.id)).toBe(true);
    await setClubStatus(open.id, "hidden");
    expect((await listClubs(outsider)).some((c) => c.id === open.id)).toBe(false);
    expect(await getClub(outsider, open.id)).toBeNull();
  });
});
