// Team sign-in (SPEC-moderator.md): Supabase Auth email + password, the session in cookies through @supabase/ssr,
// and one check every moderator page and route makes: is this signed-in user in team_members?
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { db } from "./db.ts";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type TeamMember = { id: string; email: string; display_name: string };

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

/** The signed-in team member, or null. */
export async function getTeamMember(): Promise<TeamMember | null> {
  if (!URL || !ANON) return null;
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await db().from("team_members").select("id, email, display_name").eq("id", user.id).maybeSingle();
  return (data as TeamMember | null) ?? null;
}
