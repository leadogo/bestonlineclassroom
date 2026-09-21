"use server";
import { revalidatePath } from "next/cache";
import { canModerate, getTeamMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { unblockAtEdge } from "@/lib/edge-block";
import { forgetBlockedIps } from "@/lib/ip";

async function allowed(registrantId: string) {
  const me = await getTeamMember().catch(() => null);
  if (!me) throw new Error("Sign in");
  const { data } = await db().from("registrants").select("id, event_id").eq("id", registrantId).maybeSingle();
  if (!data || !(await canModerate(me, data.event_id as string))) throw new Error("Not your webinar");
  return data.id as string;
}

export async function unblockPerson(fd: FormData) {
  const id = await allowed(String(fd.get("id") ?? ""));
  await db().from("registrants").update({ blocked_at: null }).eq("id", id);
  revalidatePath("/admin/blocked");
}

export async function unghostPerson(fd: FormData) {
  const id = await allowed(String(fd.get("id") ?? ""));
  await db().from("registrants").update({ ghosted_at: null }).eq("id", id);
  revalidatePath("/admin/blocked");
}

export async function unblockIp(fd: FormData) {
  const me = await getTeamMember().catch(() => null);
  if (!me) throw new Error("Sign in");
  const ip = String(fd.get("ip") ?? "");
  const row = await db().from("blocked_ips").select("ip, edge_id").eq("ip", ip).maybeSingle();
  if (!row.data) return;
  if (row.data.edge_id) await unblockAtEdge(row.data.edge_id as string);
  await db().from("blocked_ips").delete().eq("ip", ip);
  forgetBlockedIps();
  revalidatePath("/admin/blocked");
}
