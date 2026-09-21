"use client";
import { useActionState } from "react";
import { createEvent, deleteEvent } from "./actions";

const input = "rounded-md border border-line bg-room px-3 py-2 text-base focus:border-brand focus:outline-none";

export function NewWebinar({ events }: { events: Array<{ slug: string; title: string; start_time: string }> }) {
  const [state, run, pending] = useActionState(createEvent, null);
  return (
    <form action={run} className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4">
      <h2 className="text-lg font-bold">New webinar</h2>
      <div className="flex flex-wrap gap-3">
        <input name="title" required placeholder="Title" className={`${input} min-w-64`} />
        <input name="slug" required pattern="[a-z0-9][a-z0-9-]{1,40}" placeholder="slug, e.g. spring-masterclass" className={`${input} min-w-64`} />
        <input name="start_time" placeholder="17:00 (optional)" pattern="\d{1,2}:\d{2}" className={`${input} w-40`} />
        <select name="from" className={input} defaultValue={events[0]?.slug}>
          {events.map((e) => (
            <option key={e.slug} value={e.slug}>
              Copy settings from: {e.title}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
      <p className="text-xs text-muted">Copies the schedule, CTA, emails, tags, replay copy, chapters and the simulated chat. Upload its video on the next screen. The link for it is /w/&lt;slug&gt;.</p>
      {state?.error && <p className="text-sm text-live">{state.error}</p>}
    </form>
  );
}

export function DeleteWebinar({ slug }: { slug: string }) {
  const [state, run, pending] = useActionState(deleteEvent, null);
  return (
    <form action={run} className="flex flex-wrap items-center gap-2 text-xs">
      <input type="hidden" name="slug" value={slug} />
      <input name="confirm" placeholder={`type ${slug} to delete`} className="rounded-md border border-line bg-room px-2 py-1 text-xs focus:border-brand focus:outline-none" />
      <button type="submit" disabled={pending} className="text-live underline">
        {pending ? "Deleting…" : "Delete webinar"}
      </button>
      {state?.error && <span className="text-live">{state.error}</span>}
    </form>
  );
}
