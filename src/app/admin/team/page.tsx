import { AddMember, MemberRow } from "./team-forms";
import { getTeamMember } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function TeamAdmin() {
  const me = await getTeamMember();
  const { data } = await db().from("team_members").select("id, email, display_name").order("created_at");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Team</h1>
      <p className="text-sm text-muted">Everyone here can sign in, moderate the room and edit events. The display name is what attendees see on replies.</p>
      <ul>
        {(data ?? []).map((m) => (
          <MemberRow key={m.id} id={m.id} email={m.email} display_name={m.display_name} isMe={m.id === me?.id} />
        ))}
      </ul>
      <AddMember />
    </div>
  );
}
