"use client";
import { useActionState } from "react";
import { addMember, removeMember, renameMember, resetPassword, type TeamState } from "./actions";

const input = "rounded-md border border-line bg-room px-3 py-2 text-base focus:border-brand focus:outline-none";
const btn = "rounded-md px-3 py-2 text-sm font-bold";

function Result({ s }: { s: TeamState }) {
  if (!s) return null;
  return (
    <p className="text-sm">
      {s.ok && <span className="text-emerald-400">{s.ok}</span>} {s.error && <span className="text-live">{s.error}</span>}
      {s.password && <code className="ml-2 rounded bg-room px-2 py-1 font-mono text-base text-cta">{s.password}</code>}
    </p>
  );
}

export function AddMember() {
  const [state, run, pending] = useActionState(addMember, null);
  return (
    <form action={run} className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4">
      <h2 className="text-lg font-bold">Add a team member</h2>
      <div className="flex flex-wrap gap-3">
        <input name="email" type="email" required placeholder="email" className={input} />
        <input name="display_name" required placeholder='display name, e.g. "Sam from William’s team"' className={`${input} min-w-72`} />
        <button type="submit" disabled={pending} className={`${btn} bg-brand text-white disabled:opacity-50`}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <p className="text-xs text-muted">A password is generated and shown once. Send it to them; they sign in at /login.</p>
      <Result s={state} />
    </form>
  );
}

export function MemberRow({ id, email, display_name, isMe }: { id: string; email: string; display_name: string; isMe: boolean }) {
  const [rn, rename, p1] = useActionState(renameMember, null);
  const [rs, reset, p2] = useActionState(resetPassword, null);
  const [rm, remove, p3] = useActionState(removeMember, null);
  return (
    <li className="flex flex-col gap-2 border-b border-line py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-56 text-sm text-muted">{email}</span>
        <form action={rename} className="flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input name="display_name" defaultValue={display_name} className={`${input} w-64`} />
          <button type="submit" disabled={p1} className={`${btn} border border-line text-ink`}>
            Rename
          </button>
        </form>
        <form action={reset}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={p2} className={`${btn} border border-line text-ink`}>
            Reset password
          </button>
        </form>
        {!isMe && (
          <form action={remove}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={p3} className={`${btn} text-live`} onClick={(e) => { if (!confirm(`Remove ${display_name}?`)) e.preventDefault(); }}>
              Remove
            </button>
          </form>
        )}
      </div>
      <Result s={rn ?? rs ?? rm} />
    </li>
  );
}
