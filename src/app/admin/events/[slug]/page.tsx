import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { importSimulated, removeSimulatedName, saveConfirmation, saveCopy, saveNames, saveReminders, saveSettings, saveTags } from "./actions";
import { EmailSamples } from "./email-tools";
import { getTeamMember } from "@/lib/auth";
import { CONFIRMATION_BODY, CONFIRMATION_SUBJECT } from "@/lib/email-templates";
import { ActionForm, Field } from "./forms";
import { VideoUpload } from "./video-upload";
import { chaptersText, secondsText } from "@/lib/admin";
import { currentOrNextSession, scheduleOf } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import { getEvent } from "@/lib/events";
import { REPLAY_COPY, replayCopy } from "@/lib/replay-content";

export default async function EventAdmin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if ((await getTeamMember())?.role !== "admin") redirect("/admin");
  const event = await getEvent(slug);
  if (!event) notFound();
  const next = currentOrNextSession(scheduleOf(event));
  const { count } = await db().from("simulated_messages").select("id", { count: "exact", head: true }).eq("event_id", event.id);
  const copy = replayCopy(event.replay_copy);
  const bindSettings = saveSettings.bind(null, slug);
  const bindCopy = saveCopy.bind(null, slug);
  const bindImport = importSimulated.bind(null, slug);
  const bindNames = saveNames.bind(null, slug);
  const bindRemove = removeSimulatedName.bind(null, slug);
  const bindReminders = saveReminders.bind(null, slug);
  const bindTags = saveTags.bind(null, slug);
  const bindConfirmation = saveConfirmation.bind(null, slug);
  const me = await getTeamMember();
  const rules = event.reminder_rules ?? [];
  const rule = (k: string) => rules.find((r) => r.key === k);
  const TAGS: Array<[string, string]> = [["registered", "Registered (sent by the site on opt-in)"], ["attended", "Attended"], ["missed", "Missed"], ["watched_replay", "Watched replay"], ["left_early", "Left early (before the pitch)"], ["stayed_40min", "Stayed at least 40 minutes"], ["asked_question", "Asked a question"], ["clicked_offer", "Clicked offer"], ["saw_offer_no_click", "Saw offer but didn't click"]];

  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className="text-sm text-muted">
          <Link href="/admin" className="underline">
            Events
          </Link>{" "}
          / {event.slug}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{event.title}</h1>
        <p className="mt-1 text-sm text-muted">
          Next session {next.date}.{" "}
          <Link href={`/admin/events/${slug}/sessions/${next.date}`} className="text-brand underline">
            Registrants
          </Link>{" "}
          ·{" "}
          <Link href={`/w/${slug}?at=4490&key=preview`} className="text-brand underline">
            Preview the room at 1:14:50
          </Link>{" "}
          (works while signed in)
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Video</h2>
        <VideoUpload slug={slug} current={{ url: event.video_url, seconds: event.video_seconds }} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Settings</h2>
        <ActionForm action={bindSettings} submit="Save settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" name="title" value={event.title} />
            <Field label="Host name" name="host_name" value={event.host_name} />
            <Field label="Start time (24 h)" name="start_time" value={event.start_time.slice(0, 5)} hint="On the days ticked below, at this time." />
            <Field label="Timezone" name="timezone" value={event.timezone} hint="IANA name, e.g. America/Edmonton" />
            <Field label="CTA button label" name="cta_label" value={event.cta_label ?? ""} />
            <Field label="CTA link" name="cta_href" value={event.cta_href ?? ""} hint="The booking page. The person's name, email and phone are added for iClosed." />
            <Field label="CTA appears at" name="cta_at" value={secondsText(event.cta_at_seconds)} hint="h:mm:ss into the video" />
            <Field label="CTA hides at" name="cta_hide" value={secondsText(event.cta_hide_seconds)} hint="h:mm:ss, blank = end" />
            <Field label="After the session ends, send people to" name="end_url" value={event.end_url} />
            <Field label="Replay access window (hours)" name="replay_hours" type="number" value={String(event.replay_hours)} hint="0 = no limit" />
          </div>
          <fieldset className="flex flex-wrap gap-3 text-sm">
            <legend className="mb-1 w-full font-bold">Days it runs</legend>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <label key={d} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2">
                <input type="checkbox" name={`day_${i}`} defaultChecked={(event.days ?? [0, 1, 2, 3, 4, 5, 6]).includes(i)} className="h-4 w-4 accent-brand" />
                {d}
              </label>
            ))}
          </fieldset>
          <Field label="Replay chapters" name="chapters" rows={8} value={chaptersText(event.chapters ?? [])} hint="One per line: time then label, e.g. 1:15:00 Offer and next steps" />
        </ActionForm>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Simulated chat</h2>
        <p className="text-sm text-muted">{count ?? 0} messages, {(event.simulated_names ?? []).length} names in the people list.</p>
        <ActionForm action={bindImport} submit="Import CSV (replaces all messages)">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">CSV file</span>
            <input type="file" name="csv" accept=".csv,text/csv" className="text-sm" />
            <span className="text-xs text-muted">Columns: HH:MM:SS, Name, Role, Message (EasyWebinar&apos;s export works as is).</span>
          </label>
          <Field label="Names for the people list (optional; blank = everyone in the CSV)" name="names" rows={3} hint="One per line or comma-separated." />
        </ActionForm>
        <ActionForm action={bindNames} submit="Save names">
          <Field label="People list" name="names" rows={6} value={(event.simulated_names ?? []).join("\n")} hint="Edit the list shown in the room. Removing a name here does not remove their messages; use the box below for that." />
        </ActionForm>
        <ActionForm action={bindRemove} submit="Remove this person">
          <Field label="Remove a name and every message by them" name="name" hint="Exact name as it appears." />
        </ActionForm>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Confirmation email</h2>
        <p className="text-sm text-muted">Sent the moment someone registers, with the calendar invite attached. Placeholders: {"#FIRST_NAME# #WEBINAR_DATE# #WEBINAR_TIME# #EVENT_LINK# #REPLAY_LINK# #SKOOL_LINK#"} (or {"{{first_name}}"} style). Blank = the default.</p>
        <ActionForm action={bindConfirmation} submit="Save confirmation">
          <Field label="Subject" name="subject" value={event.confirmation?.subject ?? ""} hint={`Default: ${CONFIRMATION_SUBJECT}`} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">Message</span>
            <textarea name="body" defaultValue={event.confirmation?.body ?? ""} placeholder={CONFIRMATION_BODY} rows={14} className="w-full rounded-md border border-line bg-room px-3 py-2 text-base placeholder:text-muted/60 focus:border-brand focus:outline-none" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="footer" defaultChecked={event.confirmation?.footer !== false} className="h-4 w-4 accent-brand" />
            Add the short &ldquo;why you got this&rdquo; footer
          </label>
        </ActionForm>
        <EmailSamples slug={slug} defaultTo={me?.email ?? ""} kinds={[["confirmation", "Confirmation"], ["before30", "30 minutes before"], ["before15", "15 minutes before"]]} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Reminder emails</h2>
        <p className="text-sm text-muted">Sent from our domain through Postmark once it is connected. Placeholders: {"{{first_name}} {{title}} {{host_name}} {{join_url}} {{replay_url}} {{start_local}}"}. Leave a subject blank to disable that reminder.</p>
        <ActionForm action={bindReminders} submit="Save reminders">
          {(["before30", "before15", "before5"] as const).map((k) => (
            <div key={k} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[120px_1fr]">
              <Field label="Minutes before" name={`${k}_minutes`} type="number" value={String(rule(k)?.minutes_before ?? (k === "before30" ? 30 : k === "before15" ? 15 : 5))} />
              <div className="flex flex-col gap-3">
                <Field label="Subject" name={`${k}_subject`} value={rule(k)?.subject ?? ""} />
                <Field label="Message" name={`${k}_body`} rows={5} value={rule(k)?.body ?? ""} />
              </div>
            </div>
          ))}
        </ActionForm>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">ActiveCampaign tags</h2>
        <p className="text-sm text-muted">Applied every hour from what people did (SPEC-analytics.md). Blank = that outcome sends no tag.</p>
        <ActionForm action={bindTags} submit="Save tags">
          <div className="grid gap-3 sm:grid-cols-3">
            {TAGS.map(([k, label]) => (
              <Field key={k} label={label} name={`tag_${k}`} value={(event.tags ?? {})[k] ?? ""} />
            ))}
          </div>
        </ActionForm>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Replay page copy</h2>
        <p className="text-sm text-muted">Blank fields keep the default shown as the placeholder.</p>
        <ActionForm action={bindCopy} submit="Save copy">
          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(REPLAY_COPY) as Array<keyof typeof REPLAY_COPY>).map((k) => {
              const def = REPLAY_COPY[k];
              const cur = (event.replay_copy ?? {})[k];
              const isList = Array.isArray(def);
              const value = isList ? (Array.isArray(cur) ? (cur as unknown[]).map((x) => (Array.isArray(x) ? x.join(" | ") : String(x))).join("\n") : "") : typeof cur === "string" ? cur : "";
              const placeholder = isList ? (def as unknown[]).map((x) => (Array.isArray(x) ? x.join(" | ") : String(x))).join("\n") : String(def);
              return (
                <label key={k} className={`flex flex-col gap-1 text-sm ${isList || String(def).length > 80 ? "sm:col-span-2" : ""}`}>
                  <span className="font-bold">{k}</span>
                  <textarea name={k} defaultValue={value} placeholder={placeholder} rows={isList ? 4 : 2} className="w-full rounded-md border border-line bg-room px-3 py-2 text-base placeholder:text-muted/60 focus:border-brand focus:outline-none" />
                  {isList && <span className="text-xs text-muted">{k === "faq" ? "One per line: question | answer" : "One per line"}</span>}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted">Current headline on the page: &ldquo;{copy.headline}&rdquo;</p>
        </ActionForm>
      </section>
    </div>
  );
}
