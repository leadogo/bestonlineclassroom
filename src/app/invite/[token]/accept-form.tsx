"use client";
import { useActionState } from "react";
import { accept } from "./actions";

const input = "mt-2 min-h-12 w-full rounded-xl border border-line bg-panel px-4 text-base focus:border-brand focus:outline-none";

export function AcceptForm({ token, displayName }: { token: string; displayName: string }) {
  const [state, run, pending] = useActionState(accept.bind(null, token), null);
  return (
    <form action={run} className="mt-6 flex flex-col">
      <label htmlFor="display_name" className="text-base font-bold">
        Your name in the chat
      </label>
      <input id="display_name" name="display_name" defaultValue={displayName} maxLength={60} required className={input} />
      <label htmlFor="password" className="mt-4 text-base font-bold">
        Choose a password
      </label>
      <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={input} />
      <label htmlFor="confirm" className="mt-4 text-base font-bold">
        Type it again
      </label>
      <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className={input} />
      {state?.error && <p className="mt-3 text-base text-live">{state.error}</p>}
      <button type="submit" disabled={pending} className="mt-5 min-h-12 w-full rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50">
        {pending ? "Setting up…" : "Save and sign in"}
      </button>
    </form>
  );
}
