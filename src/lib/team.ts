// Team invitations (SPEC-phase4 roles-team): an admin invites by email; the person opens /invite/<token>, picks a
// password and is signed in with that device trusted. Invites live 7 days and are single use.
import { randomBytes } from "node:crypto";
import { db } from "./db.ts";
import { sendEmail } from "./postmark.ts";
import type { Role } from "./auth.ts";

const APP = (process.env.NEXT_PUBLIC_APP_URL ?? "https://bestonlineclassroom.com").replace(/\/$/, "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type Invite = { token: string; email: string; display_name: string; role: Role; event_ids: string[]; expires_at: string; used_at: string | null };

export const inviteUrl = (token: string) => `${APP}/invite/${token}`;

/** Creates (or refreshes) the invite for an email and sends it. */
export async function inviteMember(input: { email: string; display_name: string; role: Role; event_ids: string[]; invited_by: string; inviter_name: string }): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || !input.display_name.trim()) return { ok: false, error: "Email and display name are required." };
  await db().from("team_invites").delete().eq("email", email).is("used_at", null);
  const token = randomBytes(18).toString("base64url");
  const { error } = await db().from("team_invites").insert({ token, email, display_name: input.display_name.trim().slice(0, 60), role: input.role, event_ids: input.event_ids, invited_by: input.invited_by, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() });
  if (error) return { ok: false, error: "Could not save the invite." };
  return sendInvite(token, email, input.display_name, input.inviter_name);
}

export async function sendInvite(token: string, email: string, name: string, inviterName: string): Promise<{ ok: boolean; error?: string }> {
  const url = inviteUrl(token);
  const text = `Hi ${name},\n\n${inviterName} added you to the BestOnlineClassroom team. Open this link to choose a password and sign in:\n\n${url}\n\nThe link works once and expires in 7 days.`;
  const html = `<p style="font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif">Hi ${name},</p><p style="font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif">${inviterName} added you to the BestOnlineClassroom team. Choose a password to sign in:</p><p><a href="${url}" style="display:inline-block;background:#2F7CF6;color:#fff;font:bold 16px -apple-system,Segoe UI,Roboto,sans-serif;padding:12px 20px;border-radius:10px;text-decoration:none">Set my password</a></p><p style="font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#555">Or copy this link: ${url}<br>It works once and expires in 7 days.</p>`;
  const res = await sendEmail({ to: email, subject: "You're on the BestOnlineClassroom team", text, html, tag: "team-invite" });
  return res.ok ? { ok: true } : { ok: false, error: `Saved, but the email failed (${res.error}).` };
}

/** The invite behind a token if it is still open. */
export async function openInvite(token: string): Promise<Invite | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const { data } = await db().from("team_invites").select("token, email, display_name, role, event_ids, expires_at, used_at").eq("token", token).maybeSingle();
  const inv = data as Invite | null;
  if (!inv || inv.used_at || new Date(inv.expires_at).getTime() < Date.now()) return null;
  return inv;
}

/** Sets the password, creates the team row and assignments, burns the invite. Returns the user id. */
export async function acceptInvite(inv: Invite, display_name: string, password: string): Promise<{ id?: string; error?: string }> {
  const admin = db().auth.admin;
  const created = await admin.createUser({ email: inv.email, password, email_confirm: true });
  let id = created.data.user?.id;
  if (!id) {
    const { data: list } = await admin.listUsers({ perPage: 1000 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === inv.email);
    if (!existing) return { error: created.error?.message ?? "Could not create the account." };
    await admin.updateUserById(existing.id, { password });
    id = existing.id;
  }
  const { error } = await db().from("team_members").upsert({ id, email: inv.email, display_name: display_name.trim().slice(0, 60) || inv.display_name, role: inv.role }, { onConflict: "id" });
  if (error) return { error: "Account made, but the team row failed." };
  if (inv.event_ids.length) await db().from("team_assignments").upsert(inv.event_ids.map((event_id) => ({ member_id: id, event_id })), { onConflict: "member_id,event_id" });
  await db().from("team_invites").update({ used_at: new Date().toISOString() }).eq("token", inv.token);
  return { id };
}
