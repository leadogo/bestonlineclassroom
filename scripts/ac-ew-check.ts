// Did anything write an EasyWebinar link into ActiveCampaign's WebinarJoinLink since a given time?
//   doppler run -- node scripts/ac-ew-check.ts            # last 24 hours
//   doppler run -- node scripts/ac-ew-check.ts --since 2026-10-18T14:30:00-06:00
// Prints the count and the newest few (contact id, when). Zero after the Zap "AILG Push New Session Link" was
// switched off (2026-10-18 ~2:25 pm MT) is the proof the writer is gone.
const base = (process.env.ACTIVECAMPAIGN_API_URL ?? "").replace(/\/$/, "");
const key = process.env.ACTIVECAMPAIGN_API_KEY ?? "";
if (!base || !key) throw new Error("ACTIVECAMPAIGN_API_URL / ACTIVECAMPAIGN_API_KEY missing (run under doppler)");
const i = process.argv.indexOf("--since");
const since = i >= 0 ? new Date(process.argv[i + 1]) : new Date(Date.now() - 24 * 3600 * 1000);

async function main() {
  const hits: Array<{ contact: string; udate: string; value: string }> = [];
  for (let off = 0; ; off += 100) {
    const r = await fetch(`${base}/api/3/fieldValues?filters[fieldid]=47&limit=100&offset=${off}`, { headers: { "Api-Token": key } });
    const page = (await r.json()) as { fieldValues?: Array<{ contact: string; udate: string; value: string }> };
    for (const fv of page.fieldValues ?? []) if (/easywebinar/i.test(fv.value ?? "") && new Date(fv.udate) >= since) hits.push(fv);
    if ((page.fieldValues ?? []).length < 100) break;
    await new Promise((f) => setTimeout(f, 120));
  }
  hits.sort((a, b) => b.udate.localeCompare(a.udate));
  console.log(`EasyWebinar links written since ${since.toISOString()}: ${hits.length}`);
  for (const h of hits.slice(0, 5)) console.log("  ", h.udate, "contact", h.contact, h.value.slice(0, 60));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
