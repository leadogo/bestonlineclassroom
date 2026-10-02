/** What a walled client sees (SPEC-phase7.md): a bland 404 in the room's own type, nothing that reads as a decision. */
export function NotLoaded() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-room p-6 text-center text-ink">
      <div>
        <h1 className="text-4xl font-bold tabular-nums">404</h1>
        <p className="mt-3 text-base text-muted">The video could not be loaded.</p>
      </div>
    </main>
  );
}
