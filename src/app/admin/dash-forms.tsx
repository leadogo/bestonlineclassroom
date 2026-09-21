"use client";
import { useActionState } from "react";
import { createEvent, deleteEvent } from "./actions";
import { btn, btnDanger, input, select } from "./ui";

export function NewWebinar({ events }: { events: Array<{ slug: string; title: string; start_time: string }> }) {
  const [state, run, pending] = useActionState(createEvent, null);
  return (
    <form action={run} className="flex flex-col gap-4 rounded-xl border border-dashed border-line p-5">
      <div>
        <h2 className="text-lg font-bold">New webinar</h2>
        <p className="mt-1 text-sm text-muted">Starts as a copy of one you already run: schedule, call to action, emails, tags, replay page and the simulated chat. You upload its video on the next screen. Its link will be /w/&lt;slug&gt;.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Title
          <input name="title" required placeholder="Spring Masterclass" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Slug
          <input name="slug" required pattern="[a-z0-9][a-z0-9-]{1,40}" placeholder="spring-masterclass" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Start time
          <input name="start_time" placeholder="same as the copy" pattern="\d{1,2}:\d{2}" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Copy from
          <select name="from" className={select} defaultValue={events[0]?.slug}>
            {events.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "Creating…" : "Create webinar"}
        </button>
        {state?.error && <p className="text-sm text-live">{state.error}</p>}
      </div>
    </form>
  );
}

export function DeleteWebinar({ slug }: { slug: string }) {
  const [state, run, pending] = useActionState(deleteEvent, null);
  return (
    <form action={run} className="flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm">
      <input type="hidden" name="slug" value={slug} />
      <input name="confirm" placeholder={`type ${slug} to delete`} className={`${input} max-w-60`} />
      <button type="submit" disabled={pending} className={btnDanger}>
        {pending ? "Deleting…" : "Delete this webinar"}
      </button>
      {state?.error && <span className="text-live">{state.error}</span>}
    </form>
  );
}
