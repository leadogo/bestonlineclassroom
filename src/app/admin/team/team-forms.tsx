"use client";
import { useActionState } from "react";
import { invite, removeMember, resendInvite, resetPassword, revokeInvite, saveMember, type TeamState } from "./actions";

export type EventOption = { id: string; slug: string; title: string };
import { btn, btnDanger, btnQuiet, input, select } from "../ui";

function Result({ s }: { s: TeamState }) {
  if (!s) return null;
  return (
    <p className="text-sm">
      {s.ok && <span className="text-emerald-400">{s.ok}</span>} {s.error && <span className="text-live">{s.error}</span>}
    </p>
  );
}

function RolePick({ value }: { value: "admin" | "moderator" }) {
  return (
    <select name="role" defaultValue={value} className={select}>
      <option value="admin">Admin: everything</option>
      <option value="moderator">Moderator: chat and numbers</option>
    </select>
  );
}

function Assignments({ events, checked, name }: { events: EventOption[]; checked: string[]; name: string }) {
  return (
    <fieldset className="flex flex-wrap gap-2 text-sm">
      <legend className="mb-1 w-full text-xs text-muted">Webinars (moderators only; admins have all)</legend>
      {events.map((e) => (
        <label key={e.id} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 has-[:checked]:border-brand has-[:checked]:bg-brand/10">
          <input type="checkbox" name={name} value={e.id} defaultChecked={checked.includes(e.id)} className="h-4 w-4 accent-brand" />
          {e.title}
        </label>
      ))}
    </fieldset>
  );
}

export function InviteForm({ events }: { events: EventOption[] }) {
  const [state, run, pending] = useActionState(invite, null);
  return (
    <form action={run} className="flex flex-col gap-4 rounded-xl border border-dashed border-line p-5">
      <h2 className="text-lg font-bold">Invite someone</h2>
      <div className="flex flex-wrap gap-3">
        <input name="email" type="email" required placeholder="email" className={`${input} max-w-64`} />
        <input name="display_name" required placeholder='name in the chat, e.g. "Sam from William’s team"' className={`${input} max-w-80`} />
        <RolePick value="moderator" />
      </div>
      <Assignments events={events} checked={events.map((e) => e.id)} name="event_id" />
      <div>
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "Sending…" : "Send invitation"}
        </button>
      </div>
      <p className="text-xs text-muted">They get an email with a link to choose their password. The link works once, for 7 days.</p>
      <Result s={state} />
    </form>
  );
}

export function MemberRow({ id, email, display_name, role, assigned, isMe, events, modLink }: { id: string; email: string; display_name: string; role: "admin" | "moderator"; assigned: string[]; isMe: boolean; events: EventOption[]; modLink: string }) {
  const [sv, save, p1] = useActionState(saveMember, null);
  const [rs, reset, p2] = useActionState(resetPassword, null);
  const [rm, remove, p3] = useActionState(removeMember, null);
  return (
    <li className="flex flex-col gap-3 border-b border-line py-5">
      <form action={save} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={id} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-56 text-sm text-muted">{email}{isMe ? " (you)" : ""}</span>
          <input name="display_name" defaultValue={display_name} className={`${input} max-w-72`} />
          <RolePick value={role} />
          <button type="submit" disabled={p1} className={btnQuiet}>
            Save
          </button>
        </div>
        {role === "moderator" && <Assignments events={events} checked={assigned} name="event_id" />}
      </form>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>
          Moderator link: <code className="rounded bg-room px-1.5 py-0.5 font-mono text-ink">{modLink}</code>
        </span>
        <form action={reset}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={p2} className="underline hover:text-ink">
            Email a password reset link
          </button>
        </form>
        {!isMe && (
          <form action={remove}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={p3} className={`${btnDanger} min-h-0 px-1`} onClick={(e) => { if (!confirm(`Remove ${display_name}?`)) e.preventDefault(); }}>
              Remove
            </button>
          </form>
        )}
      </div>
      <Result s={sv ?? rs ?? rm} />
    </li>
  );
}

export function InviteRow({ token, email, display_name, role, expires_at }: { token: string; email: string; display_name: string; role: string; expires_at: string }) {
  const [rs, resend, p1] = useActionState(resendInvite, null);
  const [rv, revoke, p2] = useActionState(revokeInvite, null);
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line py-3 text-sm">
      <span className="min-w-56 text-muted">{email}</span>
      <span>{display_name}</span>
      <span className="text-muted">{role}, expires {new Date(expires_at).toLocaleDateString()}</span>
      <form action={resend}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" disabled={p1} className="text-xs underline hover:text-ink">
          Resend
        </button>
      </form>
      <form action={revoke}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" disabled={p2} className="text-xs text-live underline">
          Revoke
        </button>
      </form>
      <Result s={rs ?? rv} />
    </li>
  );
}
