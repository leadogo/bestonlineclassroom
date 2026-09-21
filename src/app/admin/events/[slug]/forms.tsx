"use client";
import { useActionState } from "react";
import type { ActionState } from "./actions";
import { btn, input } from "../../ui";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** A form bound to a server action; the result reads next to the button, in the same words the button used. */
export function ActionForm({ action, submit, children, className = "" }: { action: Action; submit: string; children: React.ReactNode; className?: string }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className={`flex flex-col gap-4 ${className}`}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "Saving…" : submit}
        </button>
        {state?.ok && <span className="text-sm text-emerald-400">{state.ok}</span>}
        {state?.error && <span className="text-sm text-live">{state.error}</span>}
      </div>
    </form>
  );
}

export function Field({ label, name, value, hint, type = "text", rows, placeholder }: { label: string; name: string; value?: string; hint?: string; type?: string; rows?: number; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-bold">{label}</span>
      {rows ? <textarea name={name} defaultValue={value} rows={rows} placeholder={placeholder} className={`${input} py-2 leading-relaxed`} /> : <input name={name} type={type} defaultValue={value} placeholder={placeholder} className={input} />}
      {hint && <span className="text-xs leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}
