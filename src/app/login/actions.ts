"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedIn, supabaseServer } from "@/lib/auth";
import { deviceTrusted, sendCode, verifyCode } from "@/lib/twofactor";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=missing");
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=bad");
  const m = await getSignedIn();
  if (!m) redirect("/login?error=team");
  if (await deviceTrusted(m.id)) redirect("/admin");
  const sent = await sendCode(m.id, m.email);
  redirect(sent.ok ? "/login/verify" : `/login/verify?error=${encodeURIComponent(sent.error ?? "send")}`);
}

export type VerifyState = { error?: string; ok?: string } | null;

export async function verify(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const m = await getSignedIn();
  if (!m) redirect("/login");
  const res = await verifyCode(m.id, String(formData.get("code") ?? ""), (await headers()).get("user-agent"));
  if (!res.ok) return { error: res.error };
  redirect("/admin");
}

export async function resend(_prev: VerifyState): Promise<VerifyState> {
  const m = await getSignedIn();
  if (!m) redirect("/login");
  const res = await sendCode(m.id, m.email);
  return res.ok ? { ok: "A new code is on its way." } : { error: res.error };
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}
