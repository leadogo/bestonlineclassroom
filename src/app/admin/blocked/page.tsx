import Link from "next/link";
import { unblockIp, unblockPerson, unghostPerson } from "./actions";
import { btnQuiet, Empty, PageHeader, td, th } from "../ui";
import { assignedEventIds, getTeamMember } from "@/lib/auth";
import { db } from "@/lib/db";

type Row = { id: string; first_name: string; email: string | null; source: string; session_date: string; blocked_at: string | null; ghosted_at: string | null; ip: string | null; event: { slug: string; title: string; timezone: string } };

const when = (iso: string, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** Everyone the team has blocked or ghosted, and every blocked address, with a way back for each. */
export default async function Blocked({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const me = (await getTeamMember())!;
  const { event } = await searchParams;
  const ids = await assignedEventIds(me);
  let q = db().from("registrants").select("id, first_name, email, source, session_date, blocked_at, ghosted_at, ip, event:events!inner(slug, title, timezone)").or("blocked_at.not.is.null,ghosted_at.not.is.null").order("blocked_at", { ascending: false, nullsFirst: false }).limit(500);
  if (ids) q = q.in("event_id", ids);
  if (event) q = q.eq("event.slug", event);
  const [{ data }, ipsRes] = await Promise.all([q, db().from("blocked_ips").select("ip, reason, at, edge_id").order("at", { ascending: false })]);
  const rows = (data ?? []) as unknown as Row[];
  const blocked = rows.filter((r) => r.blocked_at);
  const ghosted = rows.filter((r) => r.ghosted_at && !r.blocked_at);
  const ips = ipsRes.data ?? [];
  const blockedIps = new Set(ips.map((i) => String(i.ip)));
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Blocked" subtitle={event ? `People blocked or ghosted in ${rows[0]?.event.title ?? event}. ` : "People blocked or ghosted in your webinars, and blocked addresses. "} action={event ? <Link href="/admin/blocked" className={btnQuiet}>All webinars</Link> : undefined} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Blocked people</h2>
        {blocked.length === 0 ? (
          <Empty>Nobody is blocked{event ? " here" : ""}.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-panel">
                <tr>
                  <th className={th}>Name</th>
                  <th className={th}>Email</th>
                  <th className={th}>Webinar</th>
                  <th className={th}>Session</th>
                  <th className={th}>Blocked</th>
                  <th className={th}>Address</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {blocked.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className={`${td} font-bold`}>{r.first_name}</td>
                    <td className={`${td} text-muted`}>{r.email ?? `guest (${r.source})`}</td>
                    <td className={td}>{r.event.title}</td>
                    <td className={`${td} tabular-nums`}>{r.session_date}</td>
                    <td className={`${td} tabular-nums`}>{when(r.blocked_at!, r.event.timezone)}</td>
                    <td className={td}>{r.ip ? (blockedIps.has(r.ip) ? <span className="text-live">blocked</span> : "known") : "none"}</td>
                    <td className={td}>
                      <form action={unblockPerson} className="flex gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className={btnQuiet}>
                          Unblock
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Ghosted people</h2>
        <p className="text-sm text-muted">They keep chatting; only they see it.</p>
        {ghosted.length === 0 ? (
          <Empty>Nobody is ghosted{event ? " here" : ""}.</Empty>
        ) : (
          <ul className="flex flex-col">
            {ghosted.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3 text-sm">
                <span className="font-bold">{r.first_name}</span>
                <span className="text-muted">{r.email ?? `guest (${r.source})`}</span>
                <span className="text-muted">{r.event.title}, {r.session_date}</span>
                <span className="text-muted tabular-nums">since {when(r.ghosted_at!, r.event.timezone)}</span>
                <form action={unghostPerson} className="ml-auto">
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className={btnQuiet}>
                    Unghost
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {me.role === "admin" && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Blocked addresses</h2>
          <p className="text-sm text-muted">An address block stops everyone behind it, including people at the same office or household. Addresses are kept for 30 days.</p>
          {ips.length === 0 ? (
            <Empty>No addresses are blocked.</Empty>
          ) : (
            <ul className="flex flex-col">
              {ips.map((i) => (
                <li key={String(i.ip)} className="flex flex-wrap items-center gap-3 border-b border-line py-3 text-sm">
                  <code className="rounded bg-panel px-1.5 py-0.5">{String(i.ip)}</code>
                  <span className="text-muted">{i.reason}</span>
                  <span className="text-muted">{new Date(i.at as string).toLocaleString()}</span>
                  <span className="text-xs text-muted">{i.edge_id ? "at the edge and here" : "here only"}</span>
                  <form action={unblockIp} className="ml-auto">
                    <input type="hidden" name="ip" value={String(i.ip)} />
                    <button type="submit" className={btnQuiet}>
                      Unblock address
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
