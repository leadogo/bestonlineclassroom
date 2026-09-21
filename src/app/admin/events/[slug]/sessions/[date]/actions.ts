"use server";
import { revalidatePath } from "next/cache";
import { getTeamMember } from "@/lib/auth";
import { db } from "@/lib/db";

export async function setBlocked(fd: FormData) {
  if (!(await getTeamMember().catch(() => null))) throw new Error("Sign in");
  const id = String(fd.get("id") ?? "");
  const block = fd.get("block") === "1";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const now = new Date().toISOString();
  await db().from("registrants").update({ blocked_at: block ? now : null }).eq("id", id);
  if (block) await db().from("chat_messages").update({ deleted_at: now, updated_at: now }).eq("registrant_id", id).is("deleted_at", null);
  revalidatePath(`/admin/events/${fd.get("slug")}/sessions/${fd.get("date")}`);
}
