"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/auth";
import { acceptInvite, openInvite } from "@/lib/team";
import { trustDevice } from "@/lib/twofactor";

export type AcceptState = { error?: string } | null;

export async function accept(token: string, _prev: AcceptState, fd: FormData): Promise<AcceptState> {
  const inv = await openInvite(token);
  if (!inv) return { error: "This invite link has been used or has expired. Ask for a new one." };
  const password = String(fd.get("password") ?? "");
  if (password.length < 10) return { error: "Use at least 10 characters." };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const res = await acceptInvite(inv, String(fd.get("display_name") ?? ""), password);
  if (!res.id) return { error: res.error };
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: inv.email, password });
  if (error) redirect("/login");
  await trustDevice(res.id, (await headers()).get("user-agent"));
  redirect(inv.role === "admin" ? "/admin" : "/mod");
}
