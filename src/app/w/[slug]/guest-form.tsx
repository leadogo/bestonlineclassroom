"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** One field, one button: the name shown in chat and the people list. Creates a guest registrant and opens their link. */
export function GuestForm({ slug, title, logoUrl, sessionDate, src, rid, passthrough }: { slug: string; title: string; logoUrl: string | null; sessionDate: string; src: string; rid: string | null; passthrough: Record<string, string> }) {
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
    <form onSubmit={submit} className="w-full max-w-sm">
      {logoUrl && <img src={logoUrl} alt="BestOnlineClassroom" className="mx-auto mb-8 h-9 w-auto sm:h-10" />}
      <h1 className="text-center text-2xl font-bold leading-snug text-balance">{title}</h1>
      <p className="mt-2 text-center text-base text-muted">Tell us your first name and you&apos;re in.</p>
      <label htmlFor="first_name" className="mt-8 block text-base font-bold">
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
        className="mt-2 min-h-13 w-full rounded-xl border border-line bg-panel px-4 text-lg text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
        placeholder="Sarah"
      />
      {error && <p className="mt-2 text-base text-live">{error}</p>}
      <button type="submit" disabled={busy || !name.trim()} className="mt-4 min-h-13 w-full rounded-xl bg-brand text-lg font-bold text-white shadow-[0_6px_24px_rgba(47,124,246,0.35)] disabled:opacity-40 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50">
        {busy ? "Joining…" : "Join the session"}
      </button>
    </form>
  );
}
