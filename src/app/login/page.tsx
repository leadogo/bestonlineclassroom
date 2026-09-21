import { redirect } from "next/navigation";
import { signIn } from "./actions";
import { getTeamMember } from "@/lib/auth";
import { getEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/** Team sign-in. No sign-up, no reset: accounts come from `npm run team:add`. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getTeamMember().catch(() => null)) redirect("/mod");
  const { error } = await searchParams;
  const event = await getEvent("ailg-r").catch(() => null);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={signIn} className="w-full max-w-sm">
        {event?.logo_url && <img src={event.logo_url} alt="BestOnlineClassroom" className="mx-auto mb-8 h-9 w-auto" />}
        <h1 className="text-2xl font-bold">Team sign-in</h1>
        <p className="mt-1 text-base text-muted">Moderate the live room.</p>
        <label htmlFor="email" className="mt-6 block text-base font-bold">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="mt-2 min-h-12 w-full rounded-xl border border-line bg-panel px-4 text-base focus:border-brand focus:outline-none" />
        <label htmlFor="password" className="mt-4 block text-base font-bold">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="mt-2 min-h-12 w-full rounded-xl border border-line bg-panel px-4 text-base focus:border-brand focus:outline-none" />
        {error && <p className="mt-3 text-base text-live">{error === "bad" ? "That email and password don't match." : "Enter your email and password."}</p>}
        <button type="submit" className="mt-5 min-h-12 w-full rounded-xl bg-brand text-lg font-bold text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50">
          Sign in
        </button>
      </form>
    </main>
  );
}
