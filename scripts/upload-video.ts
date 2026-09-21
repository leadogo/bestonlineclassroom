// Checks the recording can be seeked before it finishes downloading, uploads it to Vercel Blob and stores its URL
// and length on the event. Run: npm run upload:video -- --event ailg-r --file "~/Downloads/recording.mp4"
// Needs BLOB_READ_WRITE_TOKEN (Vercel project → Storage → Blob) in .env.local.
import { closeSync, createReadStream, fstatSync, openSync, readSync } from "node:fs";
import { parseArgs } from "node:util";
import { put } from "@vercel/blob";
import { db } from "../src/lib/db.ts";
import { mp4Info } from "../src/lib/mp4.ts";

const { values } = parseArgs({ options: { event: { type: "string", default: "ailg-r" }, file: { type: "string" } } });
if (!values.file) throw new Error("--file <mp4> is required");
const path = values.file.replace(/^~/, process.env.HOME ?? "");

const fd = openSync(path, "r");
const size = fstatSync(fd).size;
const info = mp4Info((off, len) => { const b = Buffer.alloc(len); const n = readSync(fd, b, 0, len, off); return b.subarray(0, n); }, size);
closeSync(fd);
console.log("atoms:", info.atoms.map((a) => `${a.type}@${a.offset}`).join(" "), `duration ${info.durationSeconds}s`);
if (!info.faststart) throw new Error("moov comes after mdat: remux first with `ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4`");
if (!info.durationSeconds) throw new Error("could not read the duration from mvhd");

const { data: event, error: e1 } = await db().from("events").select("id, slug").eq("slug", values.event!).single();
if (e1 || !event) throw e1 ?? new Error("event not found; run the seed first");

console.log(`uploading ${(size / 1e9).toFixed(2)} GB…`);
const started = Date.now();
const blob = await put(`videos/${event.slug}.mp4`, createReadStream(path), {
  access: "public",
  multipart: true,
  contentType: "video/mp4",
  addRandomSuffix: false,
  allowOverwrite: true,
});
console.log(`uploaded in ${Math.round((Date.now() - started) / 1000)}s → ${blob.url}`);

const video_seconds = Math.floor(info.durationSeconds);
const { error: e2 } = await db().from("events").update({ video_url: blob.url, video_seconds }).eq("id", event.id);
if (e2) throw e2;
console.log(`event ${event.slug}: video_url set, video_seconds = ${video_seconds}`);
