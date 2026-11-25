import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { addPost, decideClubRequest, joinClub, leaveClub, removePost } from "@/modules/clubs/service";

const body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("join") }),
  z.object({ op: z.literal("leave") }),
  z.object({ op: z.enum(["approve", "reject"]), userId: z.uuid() }),
  z.object({ op: z.literal("post"), body: z.string().trim().min(1).max(1000) }),
  z.object({ op: z.literal("post.delete"), id: z.uuid() }),
]);

// Everything a person does on a club page, in one place.
export async function POST(req: Request, { params }: RouteContext<"/api/clubs/[id]">) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return json({ error: "not_found" }, 404);
  const r = await authedJson(req, 2_048);
  if (!r.ok) return r.res;
  const { user } = r.value;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  if (!(await rateLimit(`clubact:user:${user.id}`, 60, 3600))) return json({ error: "rate_limited" }, 429);
  const op = b.data;
  const res =
    op.op === "join"
      ? await joinClub(user.id, id.data)
      : op.op === "leave"
        ? await leaveClub(user.id, id.data)
        : op.op === "post"
          ? await addPost(user.id, id.data, op.body)
          : op.op === "post.delete"
            ? await removePost(user.id, id.data, op.id)
            : await decideClubRequest(user.id, id.data, op.userId, op.op === "approve");
  return res.ok
    ? json({ ok: true })
    : json({ error: res.error }, res.error === "not_found" ? 404 : res.error === "already" ? 409 : 403);
}
