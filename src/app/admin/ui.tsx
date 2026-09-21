// The admin's few shared pieces. One voice: sentence case, tabular numbers, the brand blue for the one action
// that matters on a screen, borders only where they separate things.
import Link from "next/link";

export const btn = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-white hover:bg-brand-deep disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60";
export const btnQuiet = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-bold text-ink hover:border-muted/60 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60";
export const btnDanger = "inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-bold text-live hover:bg-live/10 disabled:opacity-50";
export const link = "text-brand underline-offset-2 hover:underline";
export const input = "min-h-10 w-full rounded-lg border border-line bg-room px-3 text-[15px] text-ink placeholder:text-muted/60 focus:border-brand focus:outline-none";
export const select = "min-h-10 rounded-lg border border-line bg-room px-3 text-[15px] text-ink focus:border-brand focus:outline-none";
export const th = "px-3 py-2 text-left text-xs font-bold text-muted";
export const td = "px-3 py-2.5 align-top";

export function PageHeader({ crumbs, title, subtitle, action, children }: { crumbs?: Array<[string, string]>; title: string; subtitle?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-3 border-b border-line pb-5">
      {crumbs && crumbs.length > 0 && (
        <nav className="flex flex-wrap gap-1.5 text-sm text-muted" aria-label="Breadcrumb">
          {crumbs.map(([label, href], i) => (
            <span key={href} className="flex gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              <Link href={href} className="hover:text-ink">
                {label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight text-balance">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
        </div>
        {action && <div className="flex flex-wrap gap-2">{action}</div>}
      </div>
      {children}
    </header>
  );
}

/** A settings block: what it is on the left, the form on the right. */
export function Section({ id, title, description, children }: { id?: string; title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-24 gap-4 border-b border-line py-8 last:border-b-0 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "live" | "cta" }) {
  return (
    <div className="min-w-0">
      <p className={`text-[26px] font-bold leading-none tabular-nums ${tone === "live" ? "text-live" : tone === "cta" ? "text-cta" : ""}`}>{value}</p>
      <p className="mt-1.5 text-sm text-muted">{label}</p>
      {sub && <p className="text-xs text-muted/80">{sub}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}
