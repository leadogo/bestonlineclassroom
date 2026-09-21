/** What a blocked person sees instead of the room: courteous, final, with a way to write in if it was a mistake. */
export function Removed({ logoUrl }: { logoUrl: string | null }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-room p-6 text-center text-ink">
      <div className="max-w-sm">
        {logoUrl && <img src={logoUrl} alt="" className="mx-auto mb-8 h-9 w-auto opacity-90" />}
        <h1 className="text-2xl font-bold text-balance">You&rsquo;ve been removed from this session</h1>
        <p className="mt-3 text-base text-muted">
          If you think this was a mistake, email{" "}
          <a href="mailto:admin@bookmoreshowings.com" className="text-brand underline">
            admin@bookmoreshowings.com
          </a>{" "}
          and we&rsquo;ll sort it out.
        </p>
      </div>
    </main>
  );
}
