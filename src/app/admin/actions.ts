"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTeamMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { forgetEvent } from "@/lib/events";

export type DashState = { error?: string } | null;

async function admin() {
  const m = await getTeamMember().catch(() => null);
  if (!m || m.role !== "admin") throw new Error("Admins only");
  return m;
}

// What a copy carries over: everything except the video, the brand images and the rows that belong to sessions.
const COPIED = "host_name, timezone, start_time, days, cta_at_seconds, cta_hide_seconds, cta_label, cta_href, end_url, simulated_names, logo_url, icon_url, chapters, replay_hours, replay_copy, tags, reminder_rules, confirmation";

/** New webinar from an existing one; lands on its settings page. */
export async function createEvent(_prev: DashState, fd: FormData): Promise<DashState> {
  await admin();
  const slug = String(fd.get("slug") ?? "").trim().toLowerCase();
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  const from = String(fd.get("from") ?? "");
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) return { error: "Slug: letters, digits and dashes, e.g. spring-masterclass." };
  if (!title) return { error: "Give it a title." };
  const src = await db().from("events").select(`id, ${COPIED}`).eq("slug", from).maybeSingle();
  if (!src.data) return { error: "Copy from which webinar?" };
  const { id: fromId, ...settings } = src.data as { id: string } & Record<string, unknown>;
  const start_time = String(fd.get("start_time") ?? "").trim() || (settings.start_time as string);
  if (!/^\d{1,2}:\d{2}$/.test(start_time.slice(0, 5))) return { error: "Start time as HH:MM." };
  const { data: created, error } = await db().from("events").insert({ ...settings, slug, title, start_time }).select("id").single();
  if (error || !created) return { error: error?.code === "23505" ? "That slug is taken." : "Could not create it." };
  const sim = await db().from("simulated_messages").select("author_name, body, offset_seconds").eq("event_id", fromId);
  if (sim.data?.length) await db().from("simulated_messages").insert(sim.data.map((m) => ({ ...m, event_id: created.id })));
  revalidatePath("/admin");
  redirect(`/admin/events/${slug}`);
}

/** Removes a webinar and everything that hangs off it. Typing the slug is the confirmation. */
export async function deleteEvent(_prev: DashState, fd: FormData): Promise<DashState> {
  await admin();
  const slug = String(fd.get("slug") ?? "");
  if (slug !== String(fd.get("confirm") ?? "").trim()) return { error: "Type the slug to confirm." };
  if (slug === "ailg-r") return { error: "Not the main webinar." };
  const ev = await db().from("events").select("id").eq("slug", slug).maybeSingle();
  if (!ev.data) return { error: "No such webinar." };
  const id = ev.data.id as string;
  const regs = await db().from("registrants").select("id").eq("event_id", id);
  const rids = (regs.data ?? []).map((r) => r.id as string);
  for (let i = 0; i < rids.length; i += 200) {
    const chunk = rids.slice(i, i + 200);
    await db().from("attendance").delete().in("registrant_id", chunk);
    await db().from("chat_messages").delete().in("registrant_id", chunk);
  }
  await db().from("chat_messages").delete().eq("event_id", id);
  await db().from("simulated_messages").delete().eq("event_id", id);
  await db().from("link_clicks").delete().eq("event_id", id);
  await db().from("registrants").delete().eq("event_id", id);
  const { error } = await db().from("events").delete().eq("id", id);
  if (error) return { error: `Could not delete: ${error.message}` };
  forgetEvent(slug);
  revalidatePath("/admin");
  return null;
}
