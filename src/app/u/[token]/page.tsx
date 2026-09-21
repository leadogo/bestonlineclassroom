import { db } from "@/lib/db";
import { TOKEN_RE } from "@/lib/registrants";

export const dynamic = "force-dynamic";

/** One click from the bottom of a reminder: no more reminder emails to this registration. */
export default async function Unsubscribe({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let ok = false;
  if (TOKEN_RE.test(token)) {
    const { error, count } = await db().from("registrants").update({ no_email: true }, { count: "exact" }).eq("token", token);
    ok = !error && (count ?? 0) > 0;
  }
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-2xl font-bold">{ok ? "Reminders stopped" : "This link isn't valid"}</h1>
        <p className="mt-3 text-base text-muted">{ok ? "You won't get reminder emails for this registration. Your session link still works." : "Use the link at the bottom of the reminder email."}</p>
      </div>
    </main>
  );
}
