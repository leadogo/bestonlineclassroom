"use client";

const TONES = ["bg-sky-700", "bg-violet-700", "bg-emerald-700", "bg-rose-700", "bg-amber-700", "bg-teal-700", "bg-indigo-700", "bg-fuchsia-700"];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function tone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

export function Avatar({ name, size = "h-8 w-8 text-xs" }: { name: string; size?: string }) {
  return <span className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${tone(name)} ${size}`}>{initials(name)}</span>;
}

export function PeoplePanel({ hostName, you, realNames, simulatedNames }: { hostName: string; you: string; realNames: string[]; simulatedNames: string[] }) {
  const rows: Array<{ name: string; tag?: string }> = [{ name: hostName, tag: "Host" }, ...realNames.map((n) => ({ name: n, tag: n === you ? "You" : undefined })), ...simulatedNames.map((n) => ({ name: n }))];
  return (
    <ul className="h-full overflow-y-auto py-1">
      {rows.map((p, i) => (
        <li key={`${p.name}-${i}`} className="flex min-h-11 items-center gap-3 px-4 text-base">
          <Avatar name={p.name} />
          <span className="truncate">{p.name}</span>
          {p.tag && <span className="ml-auto text-sm text-muted">{p.tag}</span>}
        </li>
      ))}
    </ul>
  );
}
