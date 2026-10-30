import { after } from "next/server";
import { claimNew, forwardToStacy, parseEvents, validSignature } from "@/lib/meta-relay";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Meta's webhook for the BMS Application (Page 104542139222761 and Instagram @willkabrall). GET is the subscribe
 * handshake (META_WEBHOOK_VERIFY_TOKEN). POST checks the app-secret signature (META_APP_SECRET), answers 200 at once,
 * then in after() forwards new person-sent messages, postbacks and comments to Stacy (STACY_WEBHOOK_URL). It never
 * replies to anyone and never sees a Meta token.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const token = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";
  if (q.get("hub.mode") === "subscribe" && token && q.get("hub.verify_token") === token) return new Response(q.get("hub.challenge") ?? "", { headers: { "content-type": "text/plain" } });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET ?? "")) return new Response("Bad signature", { status: 403 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("OK"); // signed but unreadable: nothing to forward, and a 4xx would only make Meta retry
  }
  const events = parseEvents(body);
  if (events.length) after(async () => {
    try {
      const fresh = await claimNew(events);
      if (fresh.length) await forwardToStacy(fresh);
    } catch (e) {
      console.error("[meta-relay] failed", e);
    }
  });
  return new Response("OK");
}
