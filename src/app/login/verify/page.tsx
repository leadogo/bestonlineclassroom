import { redirect } from "next/navigation";
import { VerifyForm } from "./verify-form";
import { getSignedIn } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { deviceTrusted } from "@/lib/twofactor";

export const dynamic = "force-dynamic";

/** Second step on a new device: the 6-digit code from the email. */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const m = await getSignedIn();
  if (!m) redirect("/login");
  if (await deviceTrusted(m.id)) redirect("/mod");
  const { error } = await searchParams;
  const event = await getEvent("ailg-r").catch(() => null);
  const masked = m.email.replace(/^(.{2}).*(@.*)$/, "$1…$2");
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {event?.logo_url && <img src={event.logo_url} alt="BestOnlineClassroom" className="mx-auto mb-8 h-9 w-auto" />}
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="mt-1 text-base text-muted">We sent a 6-digit code to {masked}. New device, one-time step; this device is remembered for 90 days.</p>
        {error && <p className="mt-3 text-base text-live">{decodeURIComponent(error)}</p>}
        <VerifyForm />
      </div>
    </main>
  );
}
