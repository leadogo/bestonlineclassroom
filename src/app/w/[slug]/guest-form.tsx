"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** The one field on the join card: the name shown in chat and the people list. Creates a guest seat and opens their link. */
export function GuestForm({ slug, sessionDate, src, rid, passthrough, live }: { slug: string; sessionDate: string; src: string; rid: string | null; passthrough: Record<string, string>; live: boolean }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    await join(name);
  }

  async function join(who: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/guest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, first_name: who, session_date: sessionDate, src, rid }) });
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
    <form onSubmit={submit} className="mt-5">
      <label htmlFor="first_name" className="block text-sm font-bold">
        Your first name <span className="font-normal text-muted">(shown in the chat)</span>
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
        className="mt-2 min-h-13 w-full rounded-xl border border-line bg-room px-4 text-lg text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
        placeholder="Sarah"
      />
      {error && <p className="mt-2 text-base text-live">{error}</p>}
      <button type="submit" disabled={busy || !name.trim()} className="mt-4 min-h-13 w-full rounded-xl bg-brand text-lg font-bold text-white shadow-[0_6px_24px_rgba(47,124,246,0.35)] disabled:opacity-40 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50">
        {busy ? "Joining…" : live ? "Join now" : "Save my seat"}
      </button>
      <button type="button" disabled={busy} onClick={() => join("Guest")} className="mt-3 min-h-11 w-full text-sm text-muted underline-offset-2 hover:text-ink hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
        Continue without a name
      </button>
    </form>
  );
}
