import { db } from "@/lib/db";
import { TOKEN_RE } from "@/lib/registrants";

export const dynamic = "force-dynamic";

/** GET ?token=: the event's captions (WebVTT) served from our own origin so the player needs no cross-origin setup. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return new Response("", { status: 404 });
  const { data } = await db().from("registrants").select("event:events(captions_url)").eq("token", token).maybeSingle();
  const url = (data?.event as unknown as { captions_url: string | null } | null)?.captions_url;
  if (!url) return new Response("", { status: 404 });
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) return new Response("", { status: 502 });
  return new Response(await res.text(), { headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "private, max-age=3600" } });
}
