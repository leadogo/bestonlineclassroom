import { getEvent } from "@/lib/events";
import { leadStories } from "@/lib/lead-engagement";

export const dynamic = "force-dynamic";

const SECRET = process.env.REGISTER_SECRET ?? "";

/** POST { event, emails: [...] } (Bearer REGISTER_SECRET): each person's webinar story, for the closer's sitrep and the PAR board. */
export async function POST(request: Request) {
  if (!SECRET || request.headers.get("authorization") !== `Bearer ${SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let b: { event?: string; emails?: string[] };
  try {
    b = (await request.json()) as typeof b;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const event = await getEvent(b.event ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  const leads = await leadStories(event, Array.isArray(b.emails) ? b.emails.map(String) : []);
  return Response.json({ event: event.slug, leads }, { headers: { "cache-control": "no-store" } });
}
