"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTeamMember } from "@/lib/auth";
import { db } from "@/lib/db";

export type TeamState = { ok?: string; error?: string; password?: string } | null;

async function guard() {
  const m = await getTeamMember().catch(() => null);
  if (!m) throw new Error("Sign in");
  return m;
}

const newPassword = () => randomBytes(12).toString("base64url");

/** Creates the auth user with a generated password (returned once) and the team row. */
export async function addMember(_prev: TeamState, fd: FormData): Promise<TeamState> {
  await guard();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const display_name = String(fd.get("display_name") ?? "").trim().slice(0, 60);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !display_name) return { error: "Email and display name are required." };
  const password = newPassword();
  const admin = db().auth.admin;
  const created = await admin.createUser({ email, password, email_confirm: true });
  let id = created.data.user?.id;
  if (!id) {
    const { data: list } = await admin.listUsers({ perPage: 1000 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
    if (!existing) return { error: created.error?.message ?? "Could not create the account." };
    await admin.updateUserById(existing.id, { password });
    id = existing.id;
  }
  const { error } = await db().from("team_members").upsert({ id, email, display_name }, { onConflict: "id" });
  if (error) return { error: "Account made, but the team row failed." };
  revalidatePath("/admin/team");
  return { ok: `${display_name} added.`, password };
}

export async function renameMember(_prev: TeamState, fd: FormData): Promise<TeamState> {
  await guard();
  const id = String(fd.get("id") ?? "");
  const display_name = String(fd.get("display_name") ?? "").trim().slice(0, 60);
  if (!id || !display_name) return { error: "Display name is required." };
  const { error } = await db().from("team_members").update({ display_name }).eq("id", id);
  if (error) return { error: "Could not save." };
  revalidatePath("/admin/team");
  return { ok: "Saved." };
}

export async function resetPassword(_prev: TeamState, fd: FormData): Promise<TeamState> {
  await guard();
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Which member?" };
  const password = newPassword();
  const { error } = await db().auth.admin.updateUserById(id, { password });
  if (error) return { error: "Could not reset." };
  return { ok: "New password (shown once):", password };
}

export async function removeMember(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const me = await guard();
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Which member?" };
  if (id === me.id) return { error: "You can't remove yourself." };
  const { error } = await db().auth.admin.deleteUser(id);
  if (error) return { error: "Could not remove." };
  revalidatePath("/admin/team");
  return { ok: "Removed." };
}
