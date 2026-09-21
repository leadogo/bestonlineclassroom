import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { importSimulated, removeSimulatedName, saveConfirmation, saveCopy, saveNames, saveReminders, saveSettings, saveTags } from "./actions";
import { EmailSamples } from "./email-tools";
import { ActionForm, Field } from "./forms";
import { VideoUpload } from "./video-upload";
import { btnQuiet, PageHeader, Section } from "../../ui";
import { chaptersText, secondsText } from "@/lib/admin";
import { getTeamMember } from "@/lib/auth";
import { currentOrNextSession, scheduleOf } from "@/lib/daily-schedule";
import { db } from "@/lib/db";
import { CONFIRMATION_BODY, CONFIRMATION_SUBJECT } from "@/lib/email-templates";
import { getEvent } from "@/lib/events";
import { REPLAY_COPY, replayCopy } from "@/lib/replay-content";

const SECTIONS: Array<[string, string]> = [["video", "Video"], ["schedule", "Schedule and offer"], ["chat", "Simulated chat"], ["emails", "Emails"], ["tags", "ActiveCampaign tags"], ["replay", "Replay page"]];

export default async function EventAdmin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getTeamMember();
  if (me?.role !== "admin") redirect("/admin");
  const event = await getEvent(slug);
  if (!event) notFound();
  const next = currentOrNextSession(scheduleOf(event));
  const { count } = await db().from("simulated_messages").select("id", { count: "exact", head: true }).eq("event_id", event.id);
  const [sample, last] = await Promise.all([
    db().from("simulated_messages").select("offset_seconds, name, body").eq("event_id", event.id).order("offset_seconds").limit(5),
    db().from("simulated_messages").select("offset_seconds").eq("event_id", event.id).order("offset_seconds", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const copy = replayCopy(event.replay_copy);
  const bind = <T extends (slug: string, ...rest: never[]) => unknown>(fn: T) => fn.bind(null, slug) as unknown as (prev: import("./actions").ActionState, fd: FormData) => Promise<import("./actions").ActionState>;
  const rules = event.reminder_rules ?? [];
  const rule = (k: string) => rules.find((r) => r.key === k);
  const TAGS: Array<[string, string]> = [["registered", "Registered (sent on opt-in)"], ["attended", "Attended (15 min or more live)"], ["missed", "Missed (under 15 min)"], ["watched_replay", "Watched the replay"], ["left_early", "Left before the pitch"], ["stayed_40min", "Stayed 40 minutes"], ["asked_question", "Asked a question"], ["clicked_offer", "Clicked the offer"], ["saw_offer_no_click", "Saw the offer, didn't click"]];

  return (
    <div className="flex flex-col">
      <PageHeader
        crumbs={[["Webinars", "/admin"], [event.title, `/admin/events/${slug}`]]}
        title={event.title}
        subtitle={<>Next session {next.date}. The open link is /w/{slug}; a landing page or Zap registers people with <code className="rounded bg-panel px-1.5 py-0.5 text-[13px]">event: {slug}</code>.</>}
        action={
          <>
            <Link href={`/admin/events/${slug}/sessions/${next.date}`} className={btnQuiet}>
              Registrants
            </Link>
            <Link href={`/admin/events/${slug}/analytics`} className={btnQuiet}>
              Analytics
            </Link>
            <a href={`/w/${slug}?at=${Math.max(0, (event.cta_at_seconds ?? 10) - 10)}`} className={btnQuiet} target="_blank" rel="noopener">
              Preview at the pitch
            </a>
          </>
        }
      >
        <nav className="-mb-5 flex gap-1 overflow-x-auto pt-1 text-sm" aria-label="Sections">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 rounded-full px-3 py-1.5 text-muted hover:bg-line/60 hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
      </PageHeader>

      <Section id="video" title="Video" description="The recording the room plays as if live. Export it web-optimized so people can join mid-video.">
        <VideoUpload slug={slug} current={{ url: event.video_url, seconds: event.video_seconds }} />
      </Section>

      <Section id="schedule" title="Schedule and offer" description="When it runs, what the call to action says and when it appears, and where people go afterwards.">
        <ActionForm action={bind(saveSettings)} submit="Save schedule and offer">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" name="title" value={event.title} />
            <Field label="Host name" name="host_name" value={event.host_name} hint="Shown at the top of the people list and on the countdown." />
            <Field label="Host credentials (one line)" name="host_tagline" value={event.host_tagline ?? ""} placeholder="Zero to $1M GCI in 34 Months" hint="Under the name on the countdown page." />
            <Field label="Captions offset (seconds)" name="captions_offset" value={String(Number(event.captions_offset_seconds ?? 0) || 0)} hint="Positive if captions run ahead of the words, negative if behind." />
            <Field label="Host photo (image link)" name="host_avatar_url" value={event.host_avatar_url ?? ""} hint="A square photo. Upload with npm run brand:upload for now." />
            <Field label="Start time (24 h)" name="start_time" value={event.start_time.slice(0, 5)} hint="On the days ticked below, at this time." />
            <Field label="Timezone" name="timezone" value={event.timezone} hint="IANA name, e.g. America/Edmonton" />
          </div>
          <fieldset className="flex flex-wrap gap-2 text-sm">
            <legend className="mb-1.5 w-full font-bold">Days it runs</legend>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <label key={d} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 has-[:checked]:border-brand has-[:checked]:bg-brand/10">
                <input type="checkbox" name={`day_${i}`} defaultChecked={(event.days ?? [0, 1, 2, 3, 4, 5, 6]).includes(i)} className="h-4 w-4 accent-brand" />
                {d}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Call to action button" name="cta_label" value={event.cta_label ?? ""} />
            <Field label="Banner title" name="cta_title" value={event.cta_title ?? ""} placeholder="Ready to take the next step?" hint="The line above the button when the offer appears." />
            <Field label="Banner subtitle" name="cta_subtitle" value={event.cta_subtitle ?? ""} placeholder="Book a call with William’s team while you’re here." />
            <Field label="Call to action link" name="cta_href" value={event.cta_href ?? ""} hint="The booking page. The person's name, email and phone are added for iClosed." />
            <Field label="Appears at" name="cta_at" value={secondsText(event.cta_at_seconds)} hint="h:mm:ss into the video" />
            <Field label="Hides at" name="cta_hide" value={secondsText(event.cta_hide_seconds)} hint="h:mm:ss, blank keeps it to the end" />
            <Field label="After the session ends, send people to" name="end_url" value={event.end_url} />
            <Field label="Replay window (hours)" name="replay_hours" type="number" value={String(event.replay_hours)} hint="Counted from the first time a person opens their replay link. 0 = no limit." />
          </div>
          <Field label="Replay chapters" name="chapters" rows={7} value={chaptersText(event.chapters ?? [])} hint="One per line: time then label, e.g. 1:15:00 Offer and next steps" />
        </ActionForm>
      </Section>

      <Section id="chat" title="Simulated chat" description="The crowd that plays on the video's clock. Attendees never see the difference; moderators do.">
        <div className="flex flex-col gap-8">
          {count ? (
            <div className="rounded-xl border border-line bg-panel p-4">
              <p className="text-[15px] font-bold">
                {count} messages loaded, from the start to {mmss(last.data?.offset_seconds ?? 0)}, {(event.simulated_names ?? []).length} names in the people list
              </p>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {(sample.data ?? []).map((m, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-12 shrink-0 text-muted tabular-nums">{mmss(m.offset_seconds as number)}</span>
                    <span className="min-w-0 truncate">
                      <span className="font-bold">{m.name as string}</span> {m.body as string}
                    </span>
                  </li>
                ))}
                {(count ?? 0) > 5 && <li className="text-xs text-muted">and {(count ?? 0) - 5} more</li>}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-4">
              <p className="text-[15px] font-bold">No simulated chat yet</p>
              <p className="mt-1 text-sm text-muted">The room will only show real people until a CSV is imported.</p>
            </div>
          )}
          <ActionForm action={bind(importSimulated)} submit={count ? "Replace with this CSV" : "Import CSV"}>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-bold">{count ? "Replace every simulated message with another CSV" : "CSV file"}</span>
              <input type="file" name="csv" accept=".csv,text/csv" className="text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-room file:px-3 file:py-2 file:text-sm file:font-bold file:text-ink" />
              <span className="text-xs text-muted">Columns: HH:MM:SS, Name, Role, Message. EasyWebinar&apos;s export works as is.</span>
            </label>
            <Field label="Names for the people list (optional)" name="names" rows={2} hint="One per line or comma-separated. Blank uses everyone in the CSV." />
          </ActionForm>
          <ActionForm action={bind(saveNames)} submit="Save people list">
            <Field label="People list" name="names" rows={6} value={(event.simulated_names ?? []).join("\n")} hint="Removing a name here keeps their messages. Use the box below to remove a person entirely." />
          </ActionForm>
          <ActionForm action={bind(removeSimulatedName)} submit="Remove this person">
            <Field label="Remove a name and every message by them" name="name" placeholder="Exact name as it appears" />
          </ActionForm>
        </div>
      </Section>

      <Section id="emails" title="Emails" description={<>The confirmation goes out the moment someone registers, with the calendar invite attached. Reminders go 30 and 15 minutes before the start. Placeholders: {"#FIRST_NAME# #WEBINAR_DATE# #WEBINAR_TIME# #EVENT_LINK# #REPLAY_LINK# #SKOOL_LINK#"}, or {"{{first_name}} {{join_url}}"} style.</>}>
        <div className="flex flex-col gap-8">
          <ActionForm action={bind(saveConfirmation)} submit="Save confirmation">
            <Field label="Confirmation subject" name="subject" value={event.confirmation?.subject ?? ""} placeholder={CONFIRMATION_SUBJECT} hint="Blank keeps the default shown." />
            <Field label="Confirmation message" name="body" rows={12} value={event.confirmation?.body ?? ""} placeholder={CONFIRMATION_BODY} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="footer" defaultChecked={event.confirmation?.footer !== false} className="h-4 w-4 accent-brand" />
              Add the short &ldquo;why you got this&rdquo; footer
            </label>
          </ActionForm>
          <ActionForm action={bind(saveReminders)} submit="Save reminders">
            {(["before30", "before15", "before5"] as const).map((k) => (
              <div key={k} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[140px_minmax(0,1fr)]">
                <Field label="Minutes before" name={`${k}_minutes`} type="number" value={String(rule(k)?.minutes_before ?? (k === "before30" ? 30 : k === "before15" ? 15 : 5))} />
                <div className="flex flex-col gap-3">
                  <Field label="Subject" name={`${k}_subject`} value={rule(k)?.subject ?? ""} placeholder="Blank turns this reminder off" />
                  <Field label="Message" name={`${k}_body`} rows={4} value={rule(k)?.body ?? ""} />
                </div>
              </div>
            ))}
          </ActionForm>
          <EmailSamples slug={slug} defaultTo={me?.email ?? ""} kinds={[["confirmation", "Confirmation"], ["before30", "30 minutes before"], ["before15", "15 minutes before"]]} />
        </div>
      </Section>

      <Section id="tags" title="ActiveCampaign tags" description="Applied every hour from what people did. Blank means that outcome sends no tag.">
        <ActionForm action={bind(saveTags)} submit="Save tags">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TAGS.map(([k, label]) => (
              <Field key={k} label={label} name={`tag_${k}`} value={(event.tags ?? {})[k] ?? ""} />
            ))}
          </div>
        </ActionForm>
      </Section>

      <Section id="replay" title="Replay page" description={<>The words around the replay. Blank fields keep the default shown as the placeholder. Current headline: &ldquo;{copy.headline}&rdquo;</>}>
        <ActionForm action={bind(saveCopy)} submit="Save replay page">
          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(REPLAY_COPY) as Array<keyof typeof REPLAY_COPY>).map((k) => {
              const def = REPLAY_COPY[k];
              const cur = (event.replay_copy ?? {})[k];
              const isList = Array.isArray(def);
              const value = isList ? (Array.isArray(cur) ? (cur as unknown[]).map((x) => (Array.isArray(x) ? x.join(" | ") : String(x))).join("\n") : "") : typeof cur === "string" ? cur : "";
              const placeholder = isList ? (def as unknown[]).map((x) => (Array.isArray(x) ? x.join(" | ") : String(x))).join("\n") : String(def);
              const wide = isList || String(def).length > 80;
              return (
                <div key={k} className={wide ? "sm:col-span-2" : ""}>
                  <Field label={k.replace(/_/g, " ")} name={k} rows={isList ? 4 : 2} value={value} placeholder={placeholder} hint={isList ? (k === "faq" ? "One per line: question | answer" : "One per line") : undefined} />
                </div>
              );
            })}
          </div>
        </ActionForm>
      </Section>
    </div>
  );
}
