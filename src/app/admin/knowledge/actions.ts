"use server";
// Admin → Knowledge base (SPEC-kaitlyn-knowledge.md): William answers, the rewrite comes back, he approves; her prompt reads
// the table live, so every change here is in the room on the next message.
import { revalidatePath } from "next/cache";
import { getTeamMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { kbKey } from "@/lib/kaitlyn-kb";
import { rewriteAnswer } from "@/lib/kaitlyn-rewrite";

async function admin() {
  const m = await getTeamMember().catch(() => null);
  if (!m || m.role !== "admin") throw new Error("Admins only");
  return m;
}

async function target(fd: FormData): Promise<{ eventId: string; slug: string; key: string }> {
  const slug = String(fd.get("event") ?? "");
  const key = kbKey(fd.get("key"));
  if (!key) throw new Error("Which question?");
  const ev = await db().from("events").select("id").eq("slug", slug).maybeSingle();
  if (!ev.data) throw new Error("Which webinar?");
  return { eventId: ev.data.id as string, slug, key };
}

const done = () => { revalidatePath("/admin/knowledge"); revalidatePath("/admin", "layout"); };
const now = () => new Date().toISOString();

/** His answer, the handling, and (for answers she gives) the rewrite as a proposal waiting for his OK. */
export async function answerKb(fd: FormData): Promise<void> {
  const me = await admin();
  const { eventId, key } = await target(fd);
  const question = String(fd.get("question") ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const answer = String(fd.get("answer") ?? "").trim().slice(0, 2000);
  const handling = String(fd.get("handling") ?? "answer");
  if (!["answer", "me", "ignore"].includes(handling)) throw new Error("How should she treat it?");
  if (handling === "answer" && answer.length < 2) throw new Error("Type the answer first.");
  const base = { ...(question ? { question } : {}), answer: answer || null, handling, answered_at: now(), answered_by: me.id, updated_at: now() };
  if (handling !== "answer") {
    await db().from("kaitlyn_kb").update({ ...base, approved: null, approved_at: now() }).eq("event_id", eventId).eq("key", key);
  } else {
    const q = question || String((await db().from("kaitlyn_kb").select("question").eq("event_id", eventId).eq("key", key).maybeSingle()).data?.question ?? "");
    const rw = await rewriteAnswer(q, answer);
    await db().from("kaitlyn_kb").update({ ...base, approved: rw?.text ?? answer, approved_at: null }).eq("event_id", eventId).eq("key", key);
  }
  done();
}

/** The line she will use, as shown or as he edited it. */
export async function approveKb(fd: FormData): Promise<void> {
  await admin();
  const { eventId, key } = await target(fd);
  const approved = String(fd.get("approved") ?? "").trim().slice(0, 1200);
  if (approved.length < 2) throw new Error("The line is empty.");
  await db().from("kaitlyn_kb").update({ approved, approved_at: now(), handling: "answer", updated_at: now() }).eq("event_id", eventId).eq("key", key);
  done();
}

/** Another pass of the rewrite; his words stay the fallback. */
export async function rewriteKb(fd: FormData): Promise<void> {
  await admin();
  const { eventId, key } = await target(fd);
  const row = await db().from("kaitlyn_kb").select("question, answer").eq("event_id", eventId).eq("key", key).maybeSingle();
  if (!row.data?.answer) throw new Error("Answer it first.");
  const rw = await rewriteAnswer(String(row.data.question), String(row.data.answer));
  await db().from("kaitlyn_kb").update({ approved: rw?.text ?? String(row.data.answer), updated_at: now() }).eq("event_id", eventId).eq("key", key);
  done();
}

/** A live line back to Waiting (to change it), or retired so she hands the question to William instead. */
export async function reopenKb(fd: FormData): Promise<void> {
  await admin();
  const { eventId, key } = await target(fd);
  const what = String(fd.get("what") ?? "edit");
  if (what === "retire") await db().from("kaitlyn_kb").update({ handling: "me", approved_at: now(), updated_at: now() }).eq("event_id", eventId).eq("key", key);
  else if (what === "delete") await db().from("kaitlyn_kb").delete().eq("event_id", eventId).eq("key", key);
  else {
    // Back to Waiting when there is an answer to rewrite; back to Needs you when there never was one.
    const row = await db().from("kaitlyn_kb").select("answer").eq("event_id", eventId).eq("key", key).maybeSingle();
    await db().from("kaitlyn_kb").update({ approved_at: null, handling: row.data?.answer ? "answer" : "open", updated_at: now() }).eq("event_id", eventId).eq("key", key);
  }
  done();
}

/** Folds a duplicate question into another: its asks move over, counts add up, the duplicate goes. */
export async function mergeKb(fd: FormData): Promise<void> {
  await admin();
  const { eventId, key } = await target(fd);
  const into = kbKey(fd.get("into"));
  if (!into || into === key) throw new Error("Merge into which question?");
  const [a, b] = await Promise.all([
    db().from("kaitlyn_kb").select("asked, last_asked_at, approved_at").eq("event_id", eventId).eq("key", key).maybeSingle(),
    db().from("kaitlyn_kb").select("asked, last_asked_at, handling").eq("event_id", eventId).eq("key", into).maybeSingle(),
  ]);
  if (!a.data || !b.data) throw new Error("No such question.");
  if (a.data.approved_at && b.data.handling === "open") throw new Error("That would drop an approved answer. Merge the open question into this one instead.");
  const last = [a.data.last_asked_at, b.data.last_asked_at].filter(Boolean).sort().pop() ?? null;
  const moved = await db().from("kaitlyn_decisions").update({ kb_key: into }).eq("event_id", eventId).eq("kb_key", key);
  if (moved.error) throw new Error("Could not move the asks.");
  const summed = await db().from("kaitlyn_kb").update({ asked: Number(a.data.asked) + Number(b.data.asked), last_asked_at: last, updated_at: now() }).eq("event_id", eventId).eq("key", into);
  if (summed.error) throw new Error("Could not add the counts.");
  await db().from("kaitlyn_kb").delete().eq("event_id", eventId).eq("key", key);
  done();
}
