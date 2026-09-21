"use client";
import { upload } from "@vercel/blob/client";
import { useState } from "react";
import { setVideo } from "./actions";
import { btn, btnQuiet } from "../../ui";

/** Shows the video that is there (a frame, its length) and lets you replace it: straight to Blob with progress, then the server checks and stores it. */
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

  const minutes = Math.round((current.seconds ?? 0) / 60);
  const h = Math.floor(minutes / 60);
  const length = h ? `${h} h ${minutes % 60} min` : `${minutes} min`;
  const picker = (label: string, primary: boolean) => (
    <label className={`${primary ? btn : btnQuiet} w-fit cursor-pointer`}>
      {pct === null ? label : `Uploading ${pct}%`}
      <input type="file" accept="video/mp4" className="sr-only" onChange={onFile} disabled={pct !== null} />
    </label>
  );

  return (
    <div className="flex flex-col gap-3">
      {current.url ? (
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 sm:flex-row">
          <video src={`${current.url}#t=45`} muted playsInline preload="metadata" className="aspect-video w-full max-w-64 shrink-0 rounded-lg bg-black object-cover" aria-label="A frame from the current video" />
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-[15px] font-bold">Video uploaded, {length}</p>
            <p className="text-sm text-muted">The session lasts exactly that long. The room and the replay play this file; a new upload replaces it within a minute, without touching registrants or chat.</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {picker("Replace the video", false)}
              <a href={current.url} target="_blank" rel="noopener" className={btnQuiet}>
                Open the file
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line p-5">
          <p className="text-[15px] font-bold">No video yet</p>
          <p className="text-sm text-muted">The room shows a countdown until one is uploaded. Export with &ldquo;fast start&rdquo; (web optimized) so viewers can join mid-video.</p>
          {picker("Choose an MP4 to upload", true)}
        </div>
      )}
      {pct !== null && (
        <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-line">
          <div className="h-full bg-cta transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
