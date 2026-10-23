import { chromium } from "playwright-core";
const BB = "https://api.browserbase.com/v1";
const key = process.env.BROWSERBASE_API_KEY, projectId = process.env.BROWSERBASE_PROJECT_ID, contextId = process.env.BROWSERBASE_SKOOL_CONTEXT_ID;
const bb = async (p, init) => { const r = await fetch(`${BB}${p}`, { ...init, headers: { "X-BB-API-Key": key, "content-type": "application/json" } }); const t = await r.text(); if (!r.ok) throw new Error(`${p} ${r.status} ${t.slice(0,120)}`); return t ? JSON.parse(t) : {}; };
const session = await bb("/sessions", { method: "POST", body: JSON.stringify({ projectId, timeout: 120, browserSettings: { context: { id: contextId, persist: true }, blockAds: true } }) });
const browser = await chromium.connectOverCDP(`wss://connect.browserbase.com?apiKey=${key}&sessionId=${session.id}`);
try {
  const page = browser.contexts()[0].pages()[0] ?? (await browser.contexts()[0].newPage());
  await page.goto("https://www.skool.com/bms-agent-accelerator", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  console.log("url:", page.url());
  const titles = await page.evaluate(() => Array.from(document.querySelectorAll("a[href*='/bms-agent-accelerator/']")).map(a => ({ t: (a.textContent || "").trim().slice(0, 90), h: a.getAttribute("href") })).filter(x => x.t.length > 12 && !/^\//.test(x.t)).slice(0, 14));
  console.log("feed links:"); for (const x of titles) console.log("  ", JSON.stringify(x.t), "→", x.h);
  const hit = await page.getByText("How many leads did you waste last month", { exact: false }).first().isVisible().catch(() => false);
  console.log("tonight's title visible on the feed:", hit);
  const composerOpen = await page.locator('input[placeholder="Title"]').first().isVisible().catch(() => false);
  console.log("composer still open:", composerOpen);
  await page.screenshot({ path: process.env.SHOT, fullPage: false });
} finally {
  await browser.close().catch(() => {});
  await bb(`/sessions/${session.id}`, { method: "POST", body: JSON.stringify({ projectId, status: "REQUEST_RELEASE" }) }).catch(() => {});
}
