// Integration test against a real Postgres (runs when DATABASE_URL is set).
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { idVerifications, travelerProfiles, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getFile, newKey, putFile } from "@/lib/storage";
import { applyAdminOp } from "@/modules/admin/service";
import { loginWithTelegram } from "@/modules/auth/service";
import { saveProfile } from "@/modules/profiles/service";
import { idFileKey, listPendingIds, myIdStatus, purgeDecidedIdFiles, submitId } from "./service";

const run = !!process.env.DATABASE_URL;
const base = Math.floor(Math.random() * 1e9) + 9e9;
const created: string[] = [];

async function newUser(n: number) {
  const res = await loginWithTelegram({ id: base + n, first_name: `T${n}` }, "uz");
  if (!res.ok) throw new Error("login failed");
  created.push(res.userId);
  await saveProfile(res.userId, {
    displayName: `TEST id ${n}`,
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
  return res.userId;
}

describe.runIf(run)("manual ID check (db)", () => {
  afterAll(async () => {
    await getDb().delete(users).where(inArray(users.id, created));
  });

  it("pending → replaced by a new request → approved (badge) → files erased after 30 days", async () => {
    const db = getDb();
    const [person, admin] = await Promise.all([newUser(1), newUser(2)]);
    expect(await myIdStatus(person)).toBe("none");

    const k1 = [newKey("id"), newKey("id")];
    await Promise.all(k1.map((k) => putFile(k, Buffer.from("x"), "image/webp")));
    expect((await submitId(person, k1[0], k1[1])).ok).toBe(true);
    expect(await myIdStatus(person)).toBe("pending");

    // sending again replaces the pending request and hands back the old files to delete
    const k2 = [newKey("id"), newKey("id")];
    const again = await submitId(person, k2[0], k2[1]);
    expect(again.ok && again.stale.sort()).toEqual([...k1].sort());
    const pending = await listPendingIds();
    const mine = pending.find((p) => p.userId === person)!;
    expect(await idFileKey(mine.id, "doc")).toBe(k2[0]);

    expect(await applyAdminOp(admin, { op: "id.approve", id: mine.id }, null)).toBe(true);
    expect(await applyAdminOp(admin, { op: "id.approve", id: mine.id }, null)).toBe(false); // already decided
    expect(await myIdStatus(person)).toBe("approved");
    const [p] = await db.select().from(travelerProfiles).where(eq(travelerProfiles.userId, person));
    expect(p.idVerified).toBe(true);
    expect((await submitId(person, newKey("id"), newKey("id"))).ok).toBe(false); // nothing more to send

    // not yet 30 days: files stay; after 30 days they are erased and only the status remains
    await Promise.all(k2.map((k) => putFile(k, Buffer.from("x"), "image/webp")));
    await purgeDecidedIdFiles();
    expect(await getFile(k2[0])).not.toBeNull();
    await db
      .update(idVerifications)
      .set({ reviewedAt: new Date(Date.now() - 31 * 86_400_000) })
      .where(eq(idVerifications.id, mine.id));
    await purgeDecidedIdFiles();
    expect(await getFile(k2[0])).toBeNull();
    const [v] = await db.select().from(idVerifications).where(eq(idVerifications.id, mine.id));
    expect(v).toMatchObject({ status: "approved", documentKey: null, selfieKey: null });
    expect(v.filesPurgedAt).not.toBeNull();
  });
});
