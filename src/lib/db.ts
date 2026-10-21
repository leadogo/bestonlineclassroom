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

/** PostgREST answers at most 1,000 rows whatever the limit (Oct 21: the outcome push read 1,000 of 1,688 rows and never knew). Every read that can pass that goes through here: `make(from, to)` builds the query with `.range(from, to)`. */
export async function pageAll<T>(make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  // Reads until an empty page (one extra, cheap call), so a server cap below the page size still returns everything.
  for (let from = 0; ; ) {
    const { data, error } = await make(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return out;
    out.push(...data);
    from += data.length;
  }
}
