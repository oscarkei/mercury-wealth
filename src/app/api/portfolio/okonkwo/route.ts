import { hasSession, localRequest, sameOrigin } from "../../../../lib/server";
import { databaseConfigured } from "../../../../lib/supabase-portfolio-server";
import { loadOkonkwo } from "../../../../lib/okonkwo-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!localRequest(request) || !sameOrigin(request) || !hasSession(request))
    return Response.json({ error: "Local session required." }, { status: 403 });
  if (!databaseConfigured())
    return Response.json(
      { status: "not_configured" },
      { headers: { "Cache-Control": "no-store" } },
    );
  try {
    return Response.json(await loadOkonkwo(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        error:
          "Supabase Okonkwo snapshot is unavailable.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
