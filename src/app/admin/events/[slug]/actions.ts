"use server";
import { revalidatePath } from "next/cache";
import { getTeamMember } from "@/lib/auth";
import { parseChapters, parseNames, parseSeconds } from "@/lib/admin";
import { distinctNames, parseChatCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { forgetEvent, getEvent } from "@/lib/events";
import { mp4Info } from "@/lib/mp4";
import { REPLAY_COPY } from "@/lib/replay-content";

async function guard(slug: string) {
  if ((await getTeamMember().catch(() => null))?.role !== "admin") throw new Error("Admins only");
  const event = await getEvent(slug);
  if (!event) throw new Error("Unknown event");
  return event;
}

function done(slug: string) {
  forgetEvent(slug);
  revalidatePath(`/admin/events/${slug}`);
  revalidatePath("/admin");
}

export type ActionState = { ok?: string; error?: string } | null;

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);

export async function saveSettings(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const event = await guard(slug);
  const cta_at = parseSeconds(str(fd, "cta_at"));
  const cta_hide = parseSeconds(str(fd, "cta_hide"));
  const replay_hours = Number(str(fd, "replay_hours"));
  const start_time = str(fd, "start_time", 8);
  if (!/^\d{2}:\d{2}$/.test(start_time)) return { error: "Start time must look like 17:00." };
  const replay_opens_at = str(fd, "replay_opens_at", 8);
  if (replay_opens_at && !/^\d{2}:\d{2}$/.test(replay_opens_at)) return { error: "Replay opens at must look like 20:00, or be blank." };
  if (!str(fd, "title")) return { error: "The title is required." };
  const patch = {
    title: str(fd, "title", 120),
    host_name: str(fd, "host_name", 80) || event.host_name,
    timezone: str(fd, "timezone", 64) || event.timezone,
    start_time,
    cta_label: str(fd, "cta_label", 60) || null,
    cta_href: str(fd, "cta_href", 500) || null,
    cta_at_seconds: cta_at,
    cta_hide_seconds: cta_hide,
    end_url: str(fd, "end_url", 500) || event.end_url,
    replay_hours: Number.isFinite(replay_hours) && replay_hours >= 0 ? Math.floor(replay_hours) : 72,
    replay_opens_at: replay_opens_at ? `${replay_opens_at}:00` : null,
    chapters: parseChapters(str(fd, "chapters", 4000)),
    days: [0, 1, 2, 3, 4, 5, 6].filter((d) => fd.get(`day_${d}`) === "on"),
    host_tagline: str(fd, "host_tagline", 120) || null,
    captions_offset_seconds: Number(str(fd, "captions_offset", 10)) || 0,
    host_avatar_url: str(fd, "host_avatar_url", 500) || null,
    cta_title: str(fd, "cta_title", 80) || null,
    cta_subtitle: str(fd, "cta_subtitle", 140) || null,
  };
  if (patch.days.length === 0) return { error: "Pick at least one day." };
  const { error } = await db().from("events").update(patch).eq("id", event.id);
  if (error) return { error: "Could not save." };
  done(slug);
  return { ok: "Saved." };
}

export async function saveCopy(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const event = await guard(slug);
  const overrides: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(REPLAY_COPY)) {
    const raw = fd.get(k);
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (!t) continue;
    if (typeof v === "string") overrides[k] = t.slice(0, 600);
    else if (Array.isArray(v) && typeof v[0] === "string") overrides[k] = t.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8);
    else if (Array.isArray(v)) overrides[k] = t.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p.length === 2 && p[0] && p[1]).slice(0, 8);
  }
  const { error } = await db().from("events").update({ replay_copy: overrides }).eq("id", event.id);
  if (error) return { error: "Could not save." };
  done(slug);
  return { ok: "Copy saved." };
}

export async function importSimulated(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const event = await guard(slug);
  const file = fd.get("csv");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the CSV first." };
  if (file.size > 5_000_000) return { error: "That file is over 5 MB." };
  let rows;
  try {
    rows = parseChatCsv(await file.text());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the CSV." };
  }
  if (rows.length === 0) return { error: "No messages found in that CSV." };
  const names = parseNames(str(fd, "names", 20000));
  const del = await db().from("simulated_messages").delete().eq("event_id", event.id);
  if (del.error) return { error: "Could not replace the old messages." };
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().from("simulated_messages").insert(rows.slice(i, i + 500).map((r) => ({ event_id: event.id, ...r })));
    if (error) return { error: `Stopped after ${i} messages.` };
  }
  await db().from("events").update({ simulated_names: names.length ? names : distinctNames(rows) }).eq("id", event.id);
  done(slug);
  return { ok: `${rows.length} messages imported.` };
}

export async function saveNames(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const event = await guard(slug);
  const names = parseNames(str(fd, "names", 20000));
  const { error } = await db().from("events").update({ simulated_names: names }).eq("id", event.id);
  if (error) return { error: "Could not save." };
  done(slug);
  return { ok: `${names.length} names.` };
}

export async function removeSimulatedName(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const event = await guard(slug);
  const name = str(fd, "name", 120);
  if (!name) return { error: "Which name?" };
  const del = await db().from("simulated_messages").delete().eq("event_id", event.id).eq("name", name);
  if (del.error) return { error: "Could not remove." };
  await db().from("events").update({ simulated_names: (event.simulated_names ?? []).filter((n) => n !== name) }).eq("id", event.id);
  done(slug);
  return { ok: `Removed ${name}.` };
}

/** After a browser upload to Blob: read the atoms from the URL, store it with its duration. */
export async function setVideo(slug: string, url: string): Promise<ActionState> {
  const event = await guard(slug);
  if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(url)) return { error: "Not a Blob URL." };
  const head = await fetch(url, { method: "HEAD" });
  const size = Number(head.headers.get("content-length") ?? 0);
  if (!head.ok || !size) return { error: "The file is not readable yet. Try again in a minute." };
  const first = Buffer.from(await (await fetch(url, { headers: { range: "bytes=0-16777215" } })).arrayBuffer());
  const info = mp4Info((off, len) => first.subarray(off, Math.min(off + len, first.length)), size);
  if (!info.faststart) return { error: "This MP4 has its index at the end, so viewers could not seek before it finishes downloading. Re-export with 'fast start' / 'web optimized' and upload again." };
  if (!info.durationSeconds) return { error: "Could not read the duration." };
  const { error } = await db().from("events").update({ video_url: url, video_seconds: Math.floor(info.durationSeconds) }).eq("id", event.id);
  if (error) return { error: "Could not save." };
  done(slug);
  return { ok: `Video set: ${Math.round(info.durationSeconds / 60)} minutes.` };
}

export async function saveReminders(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const event = await guard(slug);
  const rules = [];
  for (const key of ["before30", "before15", "before5", "started"]) {
    const minutes = Number(str(fd, `${key}_minutes`, 5));
    const subject = str(fd, `${key}_subject`, 200);
    const body = str(fd, `${key}_body`, 4000);
    if (!subject || !body) continue;
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 7 * 24 * 60) return { error: `${key}: minutes must be between 1 and 10080.` };
    // "started" is minutes after the start (stored negative) and goes only to people not yet in the room.
    rules.push({ key, minutes_before: key === "started" ? -Math.floor(minutes) : Math.floor(minutes), subject, body });
  }
  const { error } = await db().from("events").update({ reminder_rules: rules }).eq("id", event.id);
  if (error) return { error: "Could not save." };
  done(slug);
  return { ok: `${rules.length} reminder${rules.length === 1 ? "" : "s"} saved.` };
}

export async function saveConfirmation(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const event = await guard(slug);
  const confirmation = { subject: str(fd, "subject", 200), body: str(fd, "body", 12000), footer: fd.get("footer") === "on" };
  const { error } = await db().from("events").update({ confirmation }).eq("id", event.id);
  if (error) return { error: "Could not save." };
  done(slug);
  return { ok: "Confirmation saved." };
}

export async function saveTags(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const event = await guard(slug);
  const tags: Record<string, string> = {};
  for (const k of ["registered", "attended", "missed", "watched_replay", "left_early", "stayed_40min", "asked_question", "clicked_offer", "saw_offer_no_click"]) {
    const v = str(fd, `tag_${k}`, 80);
    if (v) tags[k] = v;
  }
  const { error } = await db().from("events").update({ tags }).eq("id", event.id);
  if (error) return { error: "Could not save." };
  done(slug);
  return { ok: "Tags saved." };
}
