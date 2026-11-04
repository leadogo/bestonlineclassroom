import { timingSafeEqual } from "node:crypto";
import { getEvent } from "@/lib/events";
import { loadRescueLists } from "@/lib/rescue-data";
import { rescueReady } from "@/lib/rescue";

export const dynamic = "force-dynamic";
const SECRET = process.env.REGISTER_SECRET ?? "";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/registrants/rescue?event=ailg-r&date=YYYY-MM-DD (Bearer REGISTER_SECRET), for Katherine's rescue calls
 * (SPEC-bookings-recovery.md M4): `rescue` = clicked the offer in that session, no booking since the click, click at
 * least 15 minutes ago, not blocked; `second_ring` = reached the pitch, did not click, no booking. Test identities
 * never appear.
 */
export async function GET(request: Request) {
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${SECRET}`);
  if (!SECRET || got.length !== want.length || !timingSafeEqual(got, want)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const event = await getEvent(q.get("event") ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Not found" }, { status: 404 });
  const date = q.get("date") ?? "";
  if (!DATE_RE.test(date)) return Response.json({ error: "Bad date" }, { status: 400 });
  try {
    const lists = await loadRescueLists(event.id, date);
    const now = Date.now();
    const rescue = lists.rescue.filter((r) => rescueReady(r, now)).map(({ clickedAt: _c, booked: _b, blocked: _x, ...r }) => r);
    return Response.json({ rescue, second_ring: lists.second_ring }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[rescue]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Read failed" }, { status: 500 });
  }
}
