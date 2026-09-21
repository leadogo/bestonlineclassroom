"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** One field, one button: the name shown in chat and the people list. Creates a guest registrant and opens their link. */
export function GuestForm({ slug, title, sessionDate, src, rid, passthrough }: { slug: string; title: string; sessionDate: string; src: string; rid: string | null; passthrough: Record<string, string> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/guest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, first_name: name, session_date: sessionDate, src, rid }) });
      const j = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok || !j.token) throw new Error(j.error ?? "Please try again.");
      const q = new URLSearchParams(passthrough).toString();
      router.push(`/j/${j.token}${q ? `?${q}` : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <p className="text-xs uppercase tracking-wide text-slate-400">Joining</p>
      <h1 className="mt-1 text-lg font-semibold leading-snug">{title}</h1>
      <label htmlFor="first_name" className="mt-5 block text-sm text-slate-300">
        Your first name
      </label>
      <input
        id="first_name"
        name="first_name"
        autoComplete="given-name"
        autoFocus
        required
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base outline-none focus:border-sky-500"
        placeholder="e.g. Sarah"
      />
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
      <button type="submit" disabled={busy || !name.trim()} className="mt-4 w-full rounded-md bg-sky-500 px-4 py-2.5 font-medium text-slate-950 disabled:opacity-50">
        {busy ? "Joining…" : "Join the session"}
      </button>
    </form>
  );
}
