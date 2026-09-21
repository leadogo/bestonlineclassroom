"use client";
import { upload } from "@vercel/blob/client";
import { useState } from "react";
import { setVideo } from "./actions";

/** Picks an MP4, sends it straight to Blob with progress, then asks the server to check and store it. */
export function VideoUpload({ slug, current }: { slug: string; current: { url: string | null; seconds: number | null } }) {
  const [pct, setPct] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg("");
    setPct(0);
    try {
      const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
      const blob = await upload(`videos/${slug}-${rand}.mp4`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/blob-upload",
        multipart: true,
        onUploadProgress: (p) => setPct(Math.round(p.percentage)),
      });
      const r = await setVideo(slug, blob.url);
      setMsg(r?.ok ?? r?.error ?? "");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setPct(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">{current.url ? `Current video: ${Math.round((current.seconds ?? 0) / 60)} minutes.` : "No video yet."}</p>
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white">
        {pct === null ? "Choose an MP4 to upload" : `Uploading ${pct}%`}
        <input type="file" accept="video/mp4" className="sr-only" onChange={onFile} disabled={pct !== null} />
      </label>
      {pct !== null && (
        <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-line">
          <div className="h-full bg-cta transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      )}
      {msg && <p className="text-sm">{msg}</p>}
      <p className="text-xs text-muted">Export with &ldquo;fast start&rdquo; (web optimized) so viewers can join mid-video. The room and replay switch to the new file within a minute.</p>
    </div>
  );
}
