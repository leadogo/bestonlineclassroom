"use client";
import { useActionState } from "react";
import type { ActionState } from "./actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** A plain form bound to a server action, with its result shown under the button. */
export function ActionForm({ action, submit, children, className = "" }: { action: Action; submit: string; children: React.ReactNode; className?: string }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className={`flex flex-col gap-3 ${className}`}>
      {children}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {pending ? "Saving…" : submit}
        </button>
        {state?.ok && <span className="text-sm text-emerald-400">{state.ok}</span>}
        {state?.error && <span className="text-sm text-live">{state.error}</span>}
      </div>
    </form>
  );
}

export function Field({ label, name, value, hint, type = "text", rows }: { label: string; name: string; value?: string; hint?: string; type?: string; rows?: number }) {
  const cls = "w-full rounded-md border border-line bg-room px-3 py-2 text-base focus:border-brand focus:outline-none";
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-bold">{label}</span>
      {rows ? <textarea name={name} defaultValue={value} rows={rows} className={cls} /> : <input name={name} type={type} defaultValue={value} className={cls} />}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
