import { AcceptForm } from "./accept-form";
import { signOutHere } from "./actions";
import { getSignedIn } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { openInvite } from "@/lib/team";

export const dynamic = "force-dynamic";

/** The link from the invitation email: pick a password, land signed in on a trusted device. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await openInvite(token);
  const event = await getEvent("ailg-r").catch(() => null);
  const me = await getSignedIn().catch(() => null);
  const other = me && inv && me.email.toLowerCase() !== inv.email.toLowerCase() ? me : null;
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
            {other ? (
              <form action={signOutHere.bind(null, inv.token)} className="mt-6 rounded-xl border border-cta/50 bg-cta/10 p-4 text-base">
                <p>
                  This browser is signed in as <strong>{other.display_name}</strong> ({other.email}). Accepting this invite would replace that session.
                </p>
                <button type="submit" className="mt-3 min-h-11 w-full rounded-xl bg-brand text-base font-bold text-white">
                  Sign out of {other.display_name} and continue
                </button>
                <p className="mt-2 text-sm text-muted">Or open this link in a private window to keep both.</p>
              </form>
            ) : (
              <AcceptForm token={inv.token} displayName={inv.display_name} />
            )}
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
