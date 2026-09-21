import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/** GET ?event=<slug>: every simulated message for the event, in offset order. Cached an hour at the edge. */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("event") ?? "";
  const event = await getEvent(slug).catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  const { data, error } = await db().from("simulated_messages").select("offset_seconds, name, body").eq("event_id", event.id).order("offset_seconds").order("id");
  if (error) return Response.json({ error: "Lookup failed" }, { status: 500 });
  return Response.json({ rows: data ?? [] }, { headers: { "cache-control": "public, max-age=3600, s-maxage=3600" } });
}
