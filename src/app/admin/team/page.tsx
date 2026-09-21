import { redirect } from "next/navigation";
import { InviteForm, InviteRow, MemberRow, type EventOption } from "./team-forms";
import { getTeamMember, type Role } from "@/lib/auth";
import { db } from "@/lib/db";

const APP = (process.env.NEXT_PUBLIC_APP_URL ?? "https://bestonlineclassroom.com").replace(/\/$/, "");

export default async function TeamAdmin() {
  const me = await getTeamMember();
  if (me?.role !== "admin") redirect("/admin");
  const [members, assignments, invites, events] = await Promise.all([
    db().from("team_members").select("id, email, display_name, role").order("created_at"),
    db().from("team_assignments").select("member_id, event_id"),
    db().from("team_invites").select("token, email, display_name, role, expires_at").is("used_at", null).gt("expires_at", new Date().toISOString()).order("created_at"),
    db().from("events").select("id, slug, title").order("created_at"),
  ]);
  const evs = (events.data ?? []) as EventOption[];
  const assignedTo = (id: string) => (assignments.data ?? []).filter((a) => a.member_id === id).map((a) => a.event_id as string);
  const modLink = (role: Role, assigned: string[]) => {
    const first = role === "admin" ? evs[0] : evs.find((e) => assigned.includes(e.id));
    return first ? `${APP}/mod/${first.slug}` : `${APP}/mod`;
  };
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Team</h1>
      <p className="text-sm text-muted">Admins run everything. Moderators open their link, moderate the chat and see the session numbers for their webinars. The display name is what attendees see on replies.</p>
      <ul>
        {(members.data ?? []).map((m) => (
          <MemberRow key={m.id} id={m.id} email={m.email} display_name={m.display_name} role={m.role as Role} assigned={assignedTo(m.id)} isMe={m.id === me.id} events={evs} modLink={modLink(m.role as Role, assignedTo(m.id))} />
        ))}
      </ul>
      {(invites.data ?? []).length > 0 && (
        <section>
          <h2 className="text-lg font-bold">Waiting on</h2>
          <ul>
            {(invites.data ?? []).map((i) => (
              <InviteRow key={i.token} token={i.token} email={i.email} display_name={i.display_name} role={i.role} expires_at={i.expires_at} />
            ))}
          </ul>
        </section>
      )}
      <InviteForm events={evs} />
    </div>
  );
}
