"use client";
import { useState } from "react";
import { btnQuiet, input } from "../../ui";

/** "Send me a sample" for each of the three emails, to any team address. */
export function EmailSamples({ slug, defaultTo, kinds }: { slug: string; defaultTo: string; kinds: Array<[string, string]> }) {
  const [to, setTo] = useState(defaultTo);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  async function send(kind: string) {
    setBusy(kind);
    setMsg("");
    try {
      const res = await fetch("/api/admin/email-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: slug, kind, to }) });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      setMsg(j.ok ? `Sent ${kind} to ${to}.` : j.error ?? "Failed.");
    } catch {
      setMsg("Failed.");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-4">
      <p className="text-sm font-bold">Send me a sample of each email</p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={to} onChange={(e) => setTo(e.target.value)} className={`${input} max-w-72`} placeholder="you@..." />
        {kinds.map(([k, label]) => (
          <button key={k} type="button" disabled={Boolean(busy)} onClick={() => send(k)} className={btnQuiet}>
            {busy === k ? "Sending…" : label}
          </button>
        ))}
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
