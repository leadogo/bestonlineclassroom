// Email two-factor for the team (SPEC-moderator.md, 2026-09-20 late): a device we have not seen gets a 6-digit
// code by email; a correct code marks the device trusted for 90 days with a signed cookie. Codes live 10
// minutes, five attempts, one send a minute.
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db.ts";
import { sendEmail } from "./postmark.ts";

const SECRET = process.env.DEVICE_SECRET ?? "";
export const DEVICE_COOKIE = "bc_device";
const DAYS = 90;

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex").slice(0, 32);
}

/** "<id>.<sig>" or null when missing or tampered. */
export function parseDevice(cookie: string | undefined): string | null {
  if (!cookie || !SECRET) return null;
  const [id, sig] = cookie.split(".");
  if (!id || !sig || !/^[a-f0-9]{32}$/.test(id)) return null;
  const want = sign(id);
  return sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want)) ? id : null;
}

export async function deviceTrusted(userId: string): Promise<boolean> {
  const id = parseDevice((await cookies()).get(DEVICE_COOKIE)?.value);
  if (!id) return false;
  const { data } = await db().from("trusted_devices").select("device_id").eq("user_id", userId).eq("device_id", id).maybeSingle();
  if (!data) return false;
  await db().from("trusted_devices").update({ last_seen_at: new Date().toISOString() }).eq("user_id", userId).eq("device_id", id);
  return true;
}

const hashCode = (userId: string, code: string) => createHmac("sha256", SECRET).update(`${userId}:${code}`).digest("hex");

/** Emails a fresh code; false when one was sent under a minute ago. */
export async function sendCode(userId: string, email: string): Promise<{ ok: boolean; error?: string }> {
  const { data: prev } = await db().from("login_codes").select("sent_at").eq("user_id", userId).maybeSingle();
  if (prev && Date.now() - new Date(prev.sent_at).getTime() < 60_000) return { ok: false, error: "A code was sent less than a minute ago. Check your inbox." };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await db().from("login_codes").upsert({ user_id: userId, code_hash: hashCode(userId, code), expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), attempts: 0, sent_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, error: "Could not create a code." };
  const text = `Your BestOnlineClassroom sign-in code is ${code}\n\nIt works for 10 minutes on the device that asked for it. If you didn't try to sign in, ignore this email.`;
  const res = await sendEmail({ to: email, subject: `${code} is your sign-in code`, text, html: `<p style="font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif">Your BestOnlineClassroom sign-in code is</p><p style="font:32px/1.2 monospace;letter-spacing:6px">${code}</p><p style="font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#555">It works for 10 minutes on the device that asked for it. If you didn't try to sign in, ignore this email.</p>`, tag: "signin-code" });
  return res.ok ? { ok: true } : { ok: false, error: `Could not send the email (${res.error}).` };
}

/** Checks the code; on success trusts this device and sets the cookie. */
export async function verifyCode(userId: string, code: string, userAgent: string | null): Promise<{ ok: boolean; error?: string }> {
  const { data: row } = await db().from("login_codes").select("code_hash, expires_at, attempts").eq("user_id", userId).maybeSingle();
  if (!row) return { ok: false, error: "No code is waiting. Ask for a new one." };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: "That code has expired. Ask for a new one." };
  if (row.attempts >= 5) return { ok: false, error: "Too many tries. Ask for a new code." };
  const want = hashCode(userId, code.replace(/\D/g, "").slice(0, 6));
  if (want.length !== row.code_hash.length || !timingSafeEqual(Buffer.from(want), Buffer.from(row.code_hash))) {
    await db().from("login_codes").update({ attempts: row.attempts + 1 }).eq("user_id", userId);
    return { ok: false, error: "That code doesn't match." };
  }
  await db().from("login_codes").delete().eq("user_id", userId);
  await trustDevice(userId, userAgent);
  return { ok: true };
}

/** Marks this browser trusted for 90 days: a row plus the signed cookie. */
export async function trustDevice(userId: string, userAgent: string | null): Promise<void> {
  const id = randomBytes(16).toString("hex");
  await db().from("trusted_devices").insert({ user_id: userId, device_id: id, user_agent: userAgent?.slice(0, 300) ?? null });
  (await cookies()).set(DEVICE_COOKIE, `${id}.${sign(id)}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: DAYS * 86_400 });
}
