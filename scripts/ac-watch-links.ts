// Rewrite ActiveCampaign's WebinarJoinLink (field 47) and ReplayLink (field 49) onto the registered texting domain
// for contacts created in the last N days (SPEC-show-rate-recovery.md, decision 2).
//
//   doppler run -- node scripts/ac-watch-links.ts            # dry run: counts by transform, nothing written
//   doppler run -- node scripts/ac-watch-links.ts --apply    # write, <= 5 requests a second, idempotent
//   --phase2               also rewrite open links, replay links and dead EasyWebinar links (needs the path rule)
//   --training             also rewrite TrainingLink (thefuturerealestateagent.com/training/start?t=) onto the watch host (needs the /training/ rule)
//   --days 90 (default)   --limit N (apply at most N writes)   --plan FILE (write the from→next plan as JSON before applying)
//   --revert FILE          put every value in FILE back to its "from" (the undo for an --apply run)
//
// Transforms: bestonlineclassroom.com/{j,replay,w}/... -> watch.bookmoreshowings.com/...; any EasyWebinar link ->
// the room's open link. Values already on the watch domain are left alone, so a re-run reports 0 pending.
const base = (process.env.ACTIVECAMPAIGN_API_URL ?? "").replace(/\/$/, "");
const key = process.env.ACTIVECAMPAIGN_API_KEY ?? "";
if (!base || !key) throw new Error("ACTIVECAMPAIGN_API_URL / ACTIVECAMPAIGN_API_KEY missing (run under doppler)");

const WATCH = "https://watch.bookmoreshowings.com";
const OPEN = `${WATCH}/w/ailg-r`;
const FIELDS: Record<string, string> = { join: "47", replay: "49" };
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const arg = (name: string, fallback: number) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : fallback; };
const days = arg("--days", 90);
const limit = arg("--limit", Infinity);
const training = args.includes("--training");
if (training) FIELDS.training = "TRAININGLINK"; // resolved to its id at run time
const planPath = (() => { const i = args.indexOf("--plan"); return i >= 0 ? args[i + 1] : ""; })();
const revertPath = (() => { const i = args.indexOf("--revert"); return i >= 0 ? args[i + 1] : ""; })();

// Cloudflare today (verified 2026-10-18 13:52 MT): watch.bookmoreshowings.com/<path> → www.bestonlineclassroom.com/j/<path>.
// So a personal join link must be the BARE token on the watch host. Open links (/w/ailg-r) and replay links need the
// second, path-preserving rule (SPEC-show-rate-recovery.md T1); pass --phase2 once that rule is live.
const phase2 = args.includes("--phase2");
const TOKEN_RE = /^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/;

export function rewrite(value: string): { next: string; kind: string } | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const m = /^https?:\/\/(?:www\.)?(bestonlineclassroom\.com|watch\.bookmoreshowings\.com)(\/(?:j\/)?([a-z0-9]{12})|\/replay\/([a-z0-9]{12})|\/w\/[a-z0-9-]+)(\?.*)?$/i.exec(v);
  if (m) {
    const [, host, path, joinTok, replayTok, query = ""] = m;
    if (joinTok && TOKEN_RE.test(joinTok)) {
      const next = `${WATCH}/${joinTok}${query}`;
      return next === v ? null : { next, kind: "personal_join" };
    }
    if (!phase2) return null;
    if (host.startsWith("watch.")) return null;
    return { next: `${WATCH}${path}${query}`, kind: replayTok ? "classroom_replay" : "classroom_open" };
  }
  const t = /^https:\/\/(?:www\.)?thefuturerealestateagent\.com(\/training\/start\?t=[a-z0-9]{12})$/i.exec(v);
  if (t) return training ? { next: `${WATCH}${t[1]}`, kind: "training" } : null;
  if (/easywebinar/i.test(v)) return phase2 ? { next: OPEN, kind: "easywebinar_dead" } : null;
  return { next: v, kind: "unknown_left" };
}

async function api(path: string, init?: RequestInit, retried = false): Promise<any> {
  const r = await fetch(`${base}/api/3${path}`, { ...init, headers: { "Api-Token": key, "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (r.status === 429 && !retried) { await sleep(1500); return api(path, init, true); } // AC allows 5 requests a second; one breath, one retry
  if (!r.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
const sleep = (ms: number) => new Promise((f) => setTimeout(f, ms));

async function writeAll(items: Array<{ id: string; contact: string; field: string; value: string }>) {
  let done = 0, failed = 0;
  for (const p of items) {
    if (done + failed >= limit) break;
    try {
      await api(`/fieldValues/${p.id}`, { method: "PUT", body: JSON.stringify({ fieldValue: { contact: p.contact, field: p.field, value: p.value } }) });
      done++;
    } catch (e) { failed++; console.error(`contact ${p.contact} field ${p.field}: ${(e as Error).message}`); }
    if ((done + failed) % 500 === 0) console.log(`…${done} written, ${failed} failed`);
    await sleep(210);
  }
  console.log(`written ${done}, failed ${failed}`);
}

async function main() {
  if (revertPath) {
    const saved = JSON.parse(await (await import("node:fs/promises")).readFile(revertPath, "utf8")) as Array<{ id: string; contact: string; field: string; from: string }>;
    console.log(`reverting ${saved.length} values from ${revertPath}`);
    await writeAll(saved.map((p) => ({ id: p.id, contact: p.contact, field: p.field, value: p.from })));
    return;
  }
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const inScope = new Set<string>();
  for (let off = 0; ; off += 100) {
    const page = await api(`/contacts?limit=100&offset=${off}&filters[created_after]=${since}`);
    for (const c of page.contacts ?? []) inScope.add(String(c.id));
    if ((page.contacts ?? []).length < 100) break;
  }
  console.log(`contacts created since ${since}: ${inScope.size}`);

  if (FIELDS.training === "TRAININGLINK") {
    const fields = await api("/fields?limit=100");
    const id = ((fields.fields ?? []) as Array<{ id: string; perstag: string }>).find((f) => f.perstag === "TRAININGLINK")?.id;
    if (!id) throw new Error("TRAININGLINK field not found");
    FIELDS.training = id;
  }
  const plan: Array<{ id: string; contact: string; field: string; from: string; next: string; kind: string }> = [];
  for (const [name, field] of Object.entries(FIELDS)) {
    for (let off = 0; ; off += 100) {
      const page = await api(`/fieldValues?filters[fieldid]=${field}&limit=100&offset=${off}`);
      for (const fv of page.fieldValues ?? []) {
        if (!inScope.has(String(fv.contact))) continue;
        const r = rewrite(String(fv.value ?? ""));
        if (r && r.kind !== "unknown_left" && r.next !== fv.value) plan.push({ id: String(fv.id), contact: String(fv.contact), field, from: String(fv.value), next: r.next, kind: `${name}:${r.kind}` });
      }
      if ((page.fieldValues ?? []).length < 100) break;
    }
  }
  const counts: Record<string, number> = {};
  for (const p of plan) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
  console.log(`pending writes: ${plan.length}`, JSON.stringify(counts));
  if (planPath) { await (await import("node:fs/promises")).writeFile(planPath, JSON.stringify(plan)); console.log(`plan written to ${planPath}`); }
  if (!apply) { console.log("dry run; pass --apply to write"); return; }
  await writeAll(plan.map((p) => ({ id: p.id, contact: p.contact, field: p.field, value: p.next })));
}

if (process.argv[1] && /ac-watch-links/.test(process.argv[1])) main().catch((e) => { console.error(e.message); process.exit(1); });
