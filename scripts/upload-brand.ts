// Uploads the wide logo (for dark backgrounds) and the icon to Blob and stores their URLs on the event.
// Run: npm run upload:brand -- --event ailg-r --dir "~/Downloads/bestonlineclassroom-logo"
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { put } from "@vercel/blob";
import { db } from "../src/lib/db.ts";

const { values } = parseArgs({ options: { event: { type: "string", default: "ailg-r" }, dir: { type: "string" } } });
if (!values.dir) throw new Error("--dir <folder> is required");
const dir = values.dir.replace(/^~/, process.env.HOME ?? "");

const { data: event, error } = await db().from("events").select("id, slug").eq("slug", values.event!).single();
if (error || !event) throw error ?? new Error("event not found");

async function up(file: string, name: string): Promise<string> {
  const blob = await put(`brand/${event!.slug}/${name}`, readFileSync(`${dir}/${file}`), { access: "public", contentType: "image/png", addRandomSuffix: false, allowOverwrite: true });
  return blob.url;
}
const logo_url = await up("logo-wide-for-dark-bg-transparent.png", "logo-wide-dark.png");
const icon_url = await up("icon-dark-256.png", "icon-dark-256.png");
const { error: e2 } = await db().from("events").update({ logo_url, icon_url }).eq("id", event.id);
if (e2) throw e2;
console.log({ logo_url, icon_url });
