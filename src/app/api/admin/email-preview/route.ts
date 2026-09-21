import { getTeamMember } from "@/lib/auth";
import { currentOrNextSession, scheduleOf } from "@/lib/daily-schedule";
import { getEvent } from "@/lib/events";
import { sendConfirmation, sendReminder } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/** POST { event, kind: "confirmation" | <rule key>, to }: sends a sample of that email to a team address. */
export async function POST(request: Request) {
  const viaCron = request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  const member = viaCron ? { email: "", display_name: "Sample" } : await getTeamMember().catch(() => null);
  if (!member) return Response.json({ error: "Sign in" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { event?: string; kind?: string; to?: string };
  const event = await getEvent(b.event ?? "ailg-r").catch(() => null);
  if (!event) return Response.json({ error: "Unknown event" }, { status: 404 });
  const to = String(b.to ?? member.email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return Response.json({ error: "Bad address" }, { status: 422 });
  const session = currentOrNextSession(scheduleOf(event));
  const person = { id: "00000000-0000-0000-0000-000000000000", first_name: member.display_name.split(" ")[0] || "Sample", email: to, token: "sampletoken1" };
  const res = b.kind === "confirmation" || !b.kind ? await sendConfirmation(person, event, session) : await (async () => {
    const rule = (event.reminder_rules ?? []).find((r) => r.key === b.kind);
    return rule ? sendReminder(rule, person, event, session) : { ok: false, error: "Unknown reminder" };
  })();
  return Response.json(res, { status: res.ok ? 200 : 502 });
}
