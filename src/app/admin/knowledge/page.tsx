import Link from "next/link";
import { answerKb, approveKb, mergeKb, reopenKb, rewriteKb } from "./actions";
import { btn, btnQuiet, Empty, PageHeader } from "../ui";
import { assignedEventIds, getTeamMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { factsLost, type KbHandling } from "@/lib/kaitlyn-kb";
import { cuesFor, windowAt } from "@/lib/transcript";

type Row = { key: string; question: string; answer: string | null; approved: string | null; handling: KbHandling; asked: number; last_asked_at: string | null; answered_at: string | null; approved_at: string | null };
type Ask = { kb_key: string; message_id: number; registrant_id: string; session_date: string; text: string; created_at: string; body: string; name: string; team: string | null; /** What William was saying on screen when they typed (the last 20 s). */ screen: string | null };

const when = (iso: string | null, tz: string) => (iso ? new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "");
const HANDLING: Record<KbHandling, string> = { open: "open", answer: "she answers it herself", me: "always handed to you", ignore: "ignored, not a question", ghost: "ghosted on the spot" };

/**
 * Admin → Knowledge base (SPEC-kaitlyn-knowledge.md): every question the room asks, folded by meaning as Kaitlyn names
 * them. Needs you: she could not answer it well. Waiting: William answered, the rewrite waits for his OK. Live: what she
 * knows. Her prompt reads the table on every message, so a change here is in the room at once.
 */
export default async function Knowledge({ searchParams }: { searchParams: Promise<{ event?: string; q?: string }> }) {
  const me = (await getTeamMember())!;
  const { event: slugParam, q } = await searchParams;
  const ids = await assignedEventIds(me);
  let evq = db().from("events").select("id, slug, title, timezone, captions_url, captions_offset_seconds").order("created_at");
  if (ids) evq = evq.in("id", ids);
  const events = ((await evq).data ?? []) as Array<{ id: string; slug: string; title: string; timezone: string; captions_url: string | null; captions_offset_seconds: number | string | null }>;
  const real = events.filter((e) => !e.slug.startsWith("test"));
  const event = events.find((e) => e.slug === slugParam) ?? real[0] ?? events[0];
  if (!event) return <Empty>No webinars yet.</Empty>;
  const canEdit = me.role === "admin";
  const tz = event.timezone || "America/Edmonton";

  const rows = ((await db().from("kaitlyn_kb").select("key, question, answer, approved, handling, asked, last_asked_at, answered_at, approved_at").eq("event_id", event.id).order("asked", { ascending: false })).data ?? []) as Row[];
  const needle = (q ?? "").trim().toLowerCase();
  const hit = (r: Row) => !needle || r.question.toLowerCase().includes(needle) || (r.approved ?? "").toLowerCase().includes(needle) || (r.answer ?? "").toLowerCase().includes(needle) || r.key.includes(needle);
  const open = rows.filter((r) => r.handling === "open").filter(hit);
  const waiting = rows.filter((r) => r.handling === "answer" && r.answer && !r.approved_at).filter(hit);
  const live = rows.filter((r) => r.approved_at && r.handling !== "open").filter(hit);

  // The latest asks behind the open and waiting cards: who said what, her draft, what the team replied.
  const keys = [...open, ...waiting].map((r) => r.key);
  const decs = keys.length ? ((await db().from("kaitlyn_decisions").select("kb_key, message_id, registrant_id, session_date, text, created_at").eq("event_id", event.id).in("kb_key", keys).order("id", { ascending: false }).limit(400)).data ?? []) : [];
  const perKey = new Map<string, typeof decs>();
  for (const d of decs) { const l = perKey.get(d.kb_key as string) ?? []; if (l.length < 5) { l.push(d); perKey.set(d.kb_key as string, l); } }
  const picked = [...perKey.values()].flat();
  const mids = picked.map((d) => d.message_id as number);
  const rids = [...new Set(picked.map((d) => d.registrant_id as string))].slice(0, 100);
  const firstMid = mids.length ? Math.min(...mids) : 0;
  const [msgs, replies, cues] = await Promise.all([
    mids.length ? db().from("chat_messages").select("id, body, author_name, offset_seconds").in("id", mids) : Promise.resolve({ data: [] as Array<{ id: number; body: string; author_name: string; offset_seconds: number }> }),
    rids.length ? db().from("chat_messages").select("id, body, session_date, mentions, created_at").eq("event_id", event.id).eq("role", "moderator").overlaps("mentions", rids).gt("id", firstMid).order("id").limit(500) : Promise.resolve({ data: [] as Array<{ id: number; body: string; session_date: string; mentions: string[]; created_at: string }> }),
    mids.length ? cuesFor(event.captions_url) : Promise.resolve([]),
  ]);
  const shift = Number(event.captions_offset_seconds ?? 0) || 0;
  const msgById = new Map((msgs.data ?? []).map((m) => [m.id as number, m]));
  const asks: Ask[] = picked.map((d) => {
    const m = msgById.get(d.message_id as number);
    const reply = (replies.data ?? []).find((r) => r.session_date === d.session_date && (r.mentions as string[]).includes(d.registrant_id as string) && (r.id as number) > (d.message_id as number) && new Date(r.created_at as string).getTime() - new Date(d.created_at as string).getTime() < 15 * 60_000);
    // What William was saying on screen when they typed (the last 20 s), so the answer is written with the context (SPEC-kaitlyn-transcript.md, C).
    const screen = m && cues.length ? windowAt(cues, (Number(m.offset_seconds) || 0) - shift, 20, 0).said.slice(0, 240) || null : null;
    return { kb_key: d.kb_key as string, message_id: d.message_id as number, registrant_id: d.registrant_id as string, session_date: d.session_date as string, text: String(d.text ?? ""), created_at: d.created_at as string, body: String(m?.body ?? ""), name: String(m?.author_name ?? "someone"), team: reply ? String(reply.body) : null, screen };
  });
  const asksFor = (key: string) => asks.filter((a) => a.kb_key === key);

  const Asks = ({ k }: { k: string }) => {
    const list = asksFor(k);
    if (!list.length) return null;
    return (
      <ul className="flex flex-col gap-1.5 text-sm">
        {list.map((a) => (
          <li key={a.message_id} className="rounded-lg bg-room px-3 py-2">
            <span className="font-bold">{a.name}</span> <span className="text-muted">{when(a.created_at, tz)}</span>
            <div className="break-words">{a.body}</div>
            {a.screen && <div className="mt-1 text-xs italic text-muted" title="What William was saying on screen when they typed">on screen: {a.screen}</div>}
            {a.text && <div className="mt-1 text-xs text-cta">her draft: {a.text}</div>}
            {a.team && <div className="mt-1 text-xs text-brand">team replied: {a.team}</div>}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Knowledge base" subtitle="What the room asks, what Kaitlyn says, and the questions that still need you. She reads this on every message.">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {real.length > 1 && real.map((e) => (
            <Link key={e.slug} href={`/admin/knowledge?event=${e.slug}`} className={`rounded-full border px-3 py-1 ${e.slug === event.slug ? "border-brand font-bold" : "border-line text-muted"}`}>{e.title}</Link>
          ))}
          <form className="flex items-center gap-2">
            <input type="hidden" name="event" value={event.slug} />
            <input name="q" defaultValue={q ?? ""} placeholder="Search questions and answers" aria-label="Search" className="min-h-9 w-64 rounded-lg border border-line bg-panel px-3 text-sm" />
            <button type="submit" className={`${btnQuiet} min-h-9 px-3`}>Search</button>
          </form>
          <span className="text-muted">{rows.length} questions · {rows.filter((r) => r.handling === "answer" && r.approved_at).length} she answers · {open.length} need you</span>
        </div>
      </PageHeader>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Needs you <span className="text-muted">{open.length}</span></h2>
        {open.length === 0 && <Empty>Nothing open. Every question the room asked has an answer or a decision.</Empty>}
        {open.map((r) => (
          <form key={r.key} action={answerKb} className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4">
            <input type="hidden" name="event" value={event.slug} />
            <input type="hidden" name="key" value={r.key} />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <input name="question" defaultValue={r.question} aria-label="The question in plain words" className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 text-lg font-bold hover:border-line focus:border-brand focus:outline-none" readOnly={!canEdit} />
              <span className="text-sm text-muted">asked {r.asked} time{r.asked === 1 ? "" : "s"}{r.last_asked_at ? ` · last ${when(r.last_asked_at, tz)}` : ""} · {r.key}</span>
            </div>
            <Asks k={r.key} />
            {canEdit && (
              <>
                <textarea name="answer" rows={3} placeholder="Your answer, in your words" aria-label="Your answer" className="w-full rounded-lg border border-line bg-room px-3 py-2 text-[15px] focus:border-brand focus:outline-none" />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  {(["answer", "me", "ignore", "ghost"] as const).map((h) => (
                    <label key={h} className="inline-flex items-center gap-1.5"><input type="radio" name="handling" value={h} defaultChecked={h === "answer"} /> {h === "answer" ? "She answers this herself" : h === "me" ? "Always hand it to me" : h === "ignore" ? "Ignore, not a question" : "Ghost them on the spot"}</label>
                  ))}
                  <button type="submit" className={`${btn} min-h-9 px-4`}>Save</button>
                </div>
              </>
            )}
          </form>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Waiting for your OK <span className="text-muted">{waiting.length}</span></h2>
        {waiting.length === 0 && <Empty>Nothing waiting.</Empty>}
        {waiting.map((r) => {
          const lost = r.answer && r.approved ? factsLost(r.answer, r.approved) : [];
          return (
            <div key={r.key} className="flex flex-col gap-3 rounded-xl border border-cta/50 bg-panel p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-bold">{r.question}</h3>
                <span className="text-sm text-muted">asked {r.asked} time{r.asked === 1 ? "" : "s"} · {r.key}</span>
              </div>
              <Asks k={r.key} />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted">You wrote</span>
                  <blockquote className="whitespace-pre-wrap rounded-lg border-l-4 border-line bg-room px-3 py-2 text-[15px]">{r.answer}</blockquote>
                </div>
                <form action={approveKb} className="flex flex-col gap-2">
                  <input type="hidden" name="event" value={event.slug} />
                  <input type="hidden" name="key" value={r.key} />
                  <label htmlFor={`ok-${r.key}`} className="text-xs uppercase tracking-wide text-muted">She will say</label>
                  <textarea id={`ok-${r.key}`} name="approved" rows={4} defaultValue={r.approved ?? r.answer ?? ""} className="w-full rounded-lg border border-line bg-room px-3 py-2 text-[15px] focus:border-brand focus:outline-none" readOnly={!canEdit} />
                  {lost.length > 0 && <p className="text-sm text-cta">The rewrite dropped {lost.join(", ")} from your words. Fix the line or use your words as they are.</p>}
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" className={`${btn} min-h-9 px-4`}>Approve</button>
                      <button type="submit" formAction={rewriteKb} className={`${btnQuiet} min-h-9 px-3`}>Rewrite again</button>
                    </div>
                  )}
                </form>
              </div>
              {canEdit && (
                <form action={approveKb} className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="hidden" name="event" value={event.slug} />
                  <input type="hidden" name="key" value={r.key} />
                  <input type="hidden" name="approved" value={r.answer ?? ""} />
                  <button type="submit" className={`${btnQuiet} min-h-8 px-3`}>Use my words as they are</button>
                  <button type="submit" formAction={reopenKb} name="what" value="delete" className="min-h-8 rounded-lg px-3 text-live hover:bg-live/10">Remove this question</button>
                </form>
              )}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Live <span className="text-muted">{live.length}</span></h2>
        {live.length === 0 && <Empty>Nothing approved yet.</Empty>}
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-panel">
          {live.map((r) => (
            <li key={r.key} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold">{r.question}</span>
                <span className="text-xs text-muted">asked {r.asked} · {HANDLING[r.handling]} · {r.key}</span>
              </div>
              {r.handling === "answer" && <p className="whitespace-pre-wrap text-[15px]">{r.approved}</p>}
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <form action={reopenKb} className="flex gap-2">
                    <input type="hidden" name="event" value={event.slug} />
                    <input type="hidden" name="key" value={r.key} />
                    {r.handling === "answer" && <button type="submit" name="what" value="edit" className={`${btnQuiet} min-h-8 px-3`}>Edit</button>}
                    {r.handling !== "me" && <button type="submit" name="what" value="retire" className={`${btnQuiet} min-h-8 px-3`} title="She hands this question to you from now on">Hand to me instead</button>}
                    {r.handling === "me" && <button type="submit" name="what" value="edit" className={`${btnQuiet} min-h-8 px-3`}>Let her answer it</button>}
                  </form>
                  <form action={mergeKb} className="flex items-center gap-2">
                    <input type="hidden" name="event" value={event.slug} />
                    <input type="hidden" name="key" value={r.key} />
                    <select name="into" aria-label="Merge into" defaultValue="" className="min-h-8 max-w-56 rounded-lg border border-line bg-panel px-2 text-xs">
                      <option value="">Merge into…</option>
                      {rows.filter((o) => o.key !== r.key).map((o) => <option key={o.key} value={o.key}>{o.question.slice(0, 60)}</option>)}
                    </select>
                    <button type="submit" className={`${btnQuiet} min-h-8 px-3`}>Merge</button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
