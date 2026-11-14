import { connection } from "next/server";

// The running build. Open pages compare it with their own <html data-build> (see UpdateBanner).
export async function GET() {
  await connection();
  return Response.json(
    { id: process.env.NEXT_DEPLOYMENT_ID ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
