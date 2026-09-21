// Team sign-in (SPEC-moderator.md): Supabase Auth email + password, the session in cookies through @supabase/ssr,
// then a 6-digit emailed code the first time a device is seen (twofactor.ts). One check every moderator and admin
// page and route makes: signed in, on the team, on a trusted device.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { db } from "./db.ts";
import { deviceTrusted } from "./twofactor.ts";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type Role = "admin" | "moderator";
export type TeamMember = { id: string; email: string; display_name: string; role: Role };

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          /* called from a Server Component: the proxy/middleware refreshes cookies instead */
        }
      },
    },
  });
}

/** The signed-in team member with the password step done, trusted device or not. */
export async function getSignedIn(): Promise<TeamMember | null> {
  if (!URL || !ANON) return null;
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await db().from("team_members").select("id, email, display_name, role").eq("id", user.id).maybeSingle();
  return (data as TeamMember | null) ?? null;
}

/** The team member allowed in: signed in and on a device that has passed the emailed code. */
export async function getTeamMember(): Promise<TeamMember | null> {
  const m = await getSignedIn();
  if (!m) return null;
  return (await deviceTrusted(m.id)) ? m : null;
}

/** Admins moderate everything; moderators only the webinars they are assigned to. */
export async function canModerate(m: TeamMember, eventId: string): Promise<boolean> {
  if (m.role === "admin") return true;
  const { data } = await db().from("team_assignments").select("event_id").eq("member_id", m.id).eq("event_id", eventId).maybeSingle();
  return Boolean(data);
}

/** Event ids a member may moderate; null means all (admin). */
export async function assignedEventIds(m: TeamMember): Promise<string[] | null> {
  if (m.role === "admin") return null;
  const { data } = await db().from("team_assignments").select("event_id").eq("member_id", m.id);
  return (data ?? []).map((r) => r.event_id as string);
}
