"use client";
import { useActionState } from "react";
import { resend, verify } from "../actions";

export function VerifyForm() {
  const [state, run, pending] = useActionState(verify, null);
  const [again, runAgain, resending] = useActionState(resend, null);
  return (
    <div className="mt-6 flex flex-col gap-4">
      <form action={run} className="flex flex-col gap-3">
        <label htmlFor="code" className="text-base font-bold">
          6-digit code
        </label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} autoFocus required className="min-h-13 w-full rounded-xl border border-line bg-panel px-4 text-center text-2xl tracking-[0.4em] focus:border-brand focus:outline-none" />
        {state?.error && <p className="text-base text-live">{state.error}</p>}
        <button type="submit" disabled={pending} className="min-h-12 w-full rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50">
          {pending ? "Checking…" : "Continue"}
        </button>
      </form>
      <form action={runAgain} className="text-center">
        <button type="submit" disabled={resending} className="text-base text-muted underline-offset-2 hover:text-ink hover:underline">
          {resending ? "Sending…" : "Send a new code"}
        </button>
        {again?.ok && <p className="mt-1 text-sm text-emerald-400">{again.ok}</p>}
        {again?.error && <p className="mt-1 text-sm text-live">{again.error}</p>}
      </form>
    </div>
  );
}
