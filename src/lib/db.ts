// The one database client: the service role, server side only. The browser never holds a Supabase key; every
// table has RLS on with no policies, so nothing but this client can read or write. Created on first use so a
// build without env still compiles.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let client: SupabaseClient | null = null;

export function dbConfigured(): boolean {
  return Boolean(URL && KEY);
}

export function db(): SupabaseClient {
  if (!client) {
    if (!dbConfigured()) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set");
    client = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
