import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { leadsCsv } from "@/modules/agencies/service";

// CSV of requests and bookings for commission invoices: administrators only.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (user?.role !== "admin") return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const day = z.iso.date();
  const from = day.safeParse(q.get("from"));
  const to = day.safeParse(q.get("to"));
  if (!from.success || !to.success)
    return new Response("from and to (YYYY-MM-DD) are required", { status: 400 });
  return new Response(await leadsCsv(from.data, to.data), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${from.data}-${to.data}.csv"`,
      "cache-control": "no-store",
    },
  });
}
