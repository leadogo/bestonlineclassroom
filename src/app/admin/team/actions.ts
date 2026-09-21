"use server";
import { revalidatePath } from "next/cache";
import { getTeamMember, type Role } from "@/lib/auth";
import { db } from "@/lib/db";
import { inviteMember, sendInvite } from "@/lib/team";

export type TeamState = { ok?: string; error?: string } | null;

async function admin() {
  const m = await getTeamMember().catch(() => null);
  if (!m || m.role !== "admin") throw new Error("Admins only");
  return m;
}

const roleOf = (v: FormDataEntryValue | null): Role => (v === "moderator" ? "moderator" : "admin");
const eventIds = (fd: FormData) => fd.getAll("event_id").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));

/** Emails an invitation; the person sets their own password at /invite/<token>. */
export async function invite(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const me = await admin();
  const res = await inviteMember({ email: String(fd.get("email") ?? ""), display_name: String(fd.get("display_name") ?? ""), role: roleOf(fd.get("role")), event_ids: eventIds(fd), invited_by: me.id, inviter_name: me.display_name });
  revalidatePath("/admin/team");
  return res.ok ? { ok: "Invitation sent." } : { error: res.error };
}

export async function resendInvite(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const me = await admin();
  const token = String(fd.get("token") ?? "");
  const { data } = await db().from("team_invites").select("email, display_name").eq("token", token).is("used_at", null).maybeSingle();
  if (!data) return { error: "That invite is gone." };
  await db().from("team_invites").update({ expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }).eq("token", token);
  const res = await sendInvite(token, data.email, data.display_name, me.display_name);
  return res.ok ? { ok: "Sent again." } : { error: res.error };
}

export async function revokeInvite(_prev: TeamState, fd: FormData): Promise<TeamState> {
  await admin();
  await db().from("team_invites").delete().eq("token", String(fd.get("token") ?? ""));
  revalidatePath("/admin/team");
  return { ok: "Revoked." };
}

/** Display name, role and webinar assignments in one save. */
export async function saveMember(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const me = await admin();
  const id = String(fd.get("id") ?? "");
  const display_name = String(fd.get("display_name") ?? "").trim().slice(0, 60);
  const role = roleOf(fd.get("role"));
  if (!id || !display_name) return { error: "Display name is required." };
  if (id === me.id && role !== "admin") return { error: "You can't demote yourself." };
  const { error } = await db().from("team_members").update({ display_name, role }).eq("id", id);
  if (error) return { error: "Could not save." };
  await db().from("team_assignments").delete().eq("member_id", id);
  const ids = eventIds(fd);
  if (ids.length) await db().from("team_assignments").insert(ids.map((event_id) => ({ member_id: id, event_id })));
  revalidatePath("/admin/team");
  return { ok: "Saved." };
}

/** A fresh invite to the same address: they pick a new password from the email. */
export async function resetPassword(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const me = await admin();
  const id = String(fd.get("id") ?? "");
  const { data } = await db().from("team_members").select("email, display_name, role").eq("id", id).maybeSingle();
  if (!data) return { error: "Which member?" };
  const assigned = await db().from("team_assignments").select("event_id").eq("member_id", id);
  const res = await inviteMember({ email: data.email, display_name: data.display_name, role: data.role as Role, event_ids: (assigned.data ?? []).map((r) => r.event_id as string), invited_by: me.id, inviter_name: me.display_name });
  return res.ok ? { ok: "Reset link emailed." } : { error: res.error };
}

export async function removeMember(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const me = await admin();
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Which member?" };
  if (id === me.id) return { error: "You can't remove yourself." };
  const { error } = await db().auth.admin.deleteUser(id);
  if (error) return { error: "Could not remove." };
  revalidatePath("/admin/team");
  return { ok: "Removed." };
}
