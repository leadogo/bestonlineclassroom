import { AcceptForm } from "./accept-form";
import { getEvent } from "@/lib/events";
import { openInvite } from "@/lib/team";

export const dynamic = "force-dynamic";

/** The link from the invitation email: pick a password, land signed in on a trusted device. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await openInvite(token);
  const event = await getEvent("ailg-r").catch(() => null);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {event?.logo_url && <img src={event.logo_url} alt="BestOnlineClassroom" className="mx-auto mb-8 h-9 w-auto" />}
        {inv ? (
          <>
            <h1 className="text-2xl font-bold">Welcome to the team</h1>
            <p className="mt-1 text-base text-muted">
              You&rsquo;re joining as {inv.role === "admin" ? "an admin" : "a moderator"} with {inv.email}. Choose a password (10+ characters) and you&rsquo;re in.
            </p>
            <AcceptForm token={inv.token} displayName={inv.display_name} />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">This link has expired</h1>
            <p className="mt-1 text-base text-muted">Invite links work once and for 7 days. Ask the person who invited you to send a new one.</p>
          </>
        )}
      </div>
    </main>
  );
}
