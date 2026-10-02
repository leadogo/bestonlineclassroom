"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const input = "mt-2 min-h-13 w-full rounded-xl border border-line bg-room px-4 text-lg text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40";

/**
 * The field on the join card. `name`: the name shown in chat (optional). `email` (SPEC-phase7.md): the email they
 * registered with, required, with the name optional under it. Creates a guest seat and opens their link.
 */
export function GuestForm({ slug, sessionDate, src, rid, passthrough, live, startLabel, field = "name" }: { slug: string; sessionDate: string; src: string; rid: string | null; passthrough: Record<string, string>; live: boolean; startLabel: string; field?: "name" | "email" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const asksEmail = field === "email";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (asksEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Enter the email you registered with.");
      return;
    }
    await join(name.trim() || (asksEmail ? "" : "Guest"));
  }

  async function join(who: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/guest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, first_name: who, session_date: sessionDate, src, rid, ...(asksEmail ? { email: email.trim() } : {}) }) });
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
      {asksEmail && (
        <>
          <label htmlFor="email" className="block text-sm font-bold">
            Your email
          </label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoFocus required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="sarah@example.com" />
        </>
      )}
      <label htmlFor="first_name" className={`block text-sm font-bold ${asksEmail ? "mt-4" : ""}`}>
        First name <span className="font-normal text-muted">(optional, shown in the chat)</span>
      </label>
      <input
        id="first_name"
        name="first_name"
        autoComplete="given-name"
        autoFocus={!asksEmail}
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={input}
        placeholder="Sarah"
      />
      {error && <p className="mt-2 text-base text-live">{error}</p>}
      <button type="submit" disabled={busy} className="mt-4 min-h-13 w-full rounded-xl bg-brand text-lg font-bold text-white shadow-[0_6px_24px_rgba(47,124,246,0.35)] disabled:opacity-40 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50">
        {busy ? "Joining…" : live ? "Join now" : `Save my seat for ${startLabel} MT`}
      </button>
    </form>
  );
}
