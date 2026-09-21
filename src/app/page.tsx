/** Nothing public lives at the root: attendees arrive on their own link (/j/<token>) or the open link (/w/<slug>). */
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <p className="text-sm text-slate-400">Your session link is in your email and calendar invite.</p>
    </main>
  );
}
