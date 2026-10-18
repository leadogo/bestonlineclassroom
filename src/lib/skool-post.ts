// Posting to Skool through a hosted browser (Browserbase) on a persistent, already-logged-in context. Skool has no
// API; this drives the real composer: Title, body, category, the "Send email to all members" toggle, Post.
// `dryRun` fills everything, screenshots, and presses Cancel instead of Post.
import { chromium, type Page } from "playwright-core";

export type SkoolPostInput = { groupSlug: string; title: string; body: string; category: string; emailAll: boolean; dryRun: boolean };
export type SkoolPostResult = { ok: boolean; postUrl?: string; emailToggle?: "on" | "off" | "unknown"; screenshot?: Buffer; error?: string; sessionId?: string };

const BB = "https://api.browserbase.com/v1";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

async function bb(path: string, init?: RequestInit) {
  const r = await fetch(`${BB}${path}`, { ...init, headers: { "X-BB-API-Key": env("BROWSERBASE_API_KEY"), "content-type": "application/json" } });
  const text = await r.text();
  if (!r.ok) throw new Error(`Browserbase ${path} → ${r.status} ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : {};
}

async function toggleColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const label = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && (e.textContent ?? "").trim() === "Send email to all members");
    const row = label?.parentElement;
    const knob = row ? Array.from(row.querySelectorAll("*")).reverse().find((e) => e.children.length <= 1 && e.getBoundingClientRect().width >= 30 && e.getBoundingClientRect().width <= 70 && e !== label) : null;
    return knob ? getComputedStyle(knob).backgroundColor : "";
  });
}

export async function postToSkool(input: SkoolPostInput): Promise<SkoolPostResult> {
  const projectId = env("BROWSERBASE_PROJECT_ID");
  const contextId = env("BROWSERBASE_SKOOL_CONTEXT_ID");
  const session = await bb("/sessions", { method: "POST", body: JSON.stringify({ projectId, timeout: 240, browserSettings: { context: { id: contextId, persist: true }, blockAds: true } }) });
  const result: SkoolPostResult = { ok: false, sessionId: session.id };
  const browser = await chromium.connectOverCDP(`wss://connect.browserbase.com?apiKey=${env("BROWSERBASE_API_KEY")}&sessionId=${session.id}`);
  try {
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(`https://www.skool.com/${input.groupSlug}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3000);
    if (/\/login/.test(page.url())) throw new Error("Skool asked for a login: the persistent context lost its session");
    const opener = page.getByText("Write something", { exact: false }).first();
    if (!(await opener.isVisible().catch(() => false))) throw new Error("composer not found on the group page");
    await opener.click();
    const title = page.locator('input[placeholder="Title"]');
    await title.waitFor({ state: "visible", timeout: 15_000 });
    await title.fill(input.title);
    const editor = page.locator(".tiptap.skool-editor").first();
    await editor.click();
    for (const [i, para] of input.body.split("\n\n").entries()) {
      if (i > 0) { await page.keyboard.press("Enter"); await page.keyboard.press("Enter"); }
      await page.keyboard.insertText(para);
    }
    await page.waitForTimeout(800);
    // Category: the control is the exact-text button; the dropdown option is whichever "Announcements" leaf is NEW after
    // the click (the feed's filter chips carry the same words, so text alone is ambiguous).
    await page.evaluate((label) => { for (const e of Array.from(document.querySelectorAll("*"))) if (e.children.length === 0 && (e.textContent ?? "").trim() === label) e.setAttribute("data-seen-before", "1"); }, input.category);
    await page.getByText("Select a category", { exact: true }).first().click();
    await page.waitForTimeout(900);
    const option = page.locator(`:text-is("${input.category}"):not([data-seen-before])`).first();
    if (!(await option.isVisible().catch(() => false))) throw new Error(`category menu did not show "${input.category}"`);
    await option.click();
    await page.waitForTimeout(600);
    const chosen = await page.getByText(input.category, { exact: true }).locator("xpath=ancestor-or-self::button[1]").first().isVisible().catch(() => false);
    const stillPlaceholder = await page.getByText("Select a category", { exact: true }).first().isVisible().catch(() => false);
    if (stillPlaceholder && !input.dryRun) throw new Error("category did not take");
    void chosen;
    // Email toggle: read its colour, click if it looks off, read again
    const before = await toggleColor(page);
    let toggle: SkoolPostResult["emailToggle"] = "unknown";
    if (input.emailAll) {
      const isOn = (c: string) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? Number(m[2]) > Number(m[1]) + 40 && Number(m[2]) > Number(m[3]) + 20 : false; };
      if (!isOn(before)) {
        const label = page.getByText("Send email to all members", { exact: true }).first();
        await label.locator("xpath=..").locator("*").last().click().catch(async () => { await label.click(); });
        await page.waitForTimeout(600);
      }
      const after = await toggleColor(page);
      toggle = isOn(after) ? "on" : after && after !== before ? "on" : before ? "off" : "unknown";
      if (toggle !== "on" && !input.dryRun) throw new Error(`email toggle not confirmed on (before ${before || "?"}, after ${after || "?"})`);
    }
    result.emailToggle = toggle;
    result.screenshot = await page.screenshot({ fullPage: false });
    if (input.dryRun) {
      await page.locator("button", { hasText: /^cancel$/i }).first().click().catch(() => {});
      result.ok = true;
      return result;
    }
    await page.locator("button", { hasText: /^post$/i }).first().click();
    const posted = page.getByText(input.title, { exact: true }).first();
    await posted.waitFor({ state: "visible", timeout: 30_000 });
    await posted.click().catch(() => {});
    await page.waitForTimeout(2500);
    result.postUrl = /\/bms-agent-accelerator\//.test(page.url()) || /skool\.com\/[^/]+\/[^/]+/.test(page.url()) ? page.url() : undefined;
    result.ok = true;
    return result;
  } catch (e) {
    result.error = (e as Error).message;
    try { const page = browser.contexts()[0]?.pages()[0]; if (page) result.screenshot = await page.screenshot({ fullPage: false }); } catch { /* no screenshot */ }
    return result;
  } finally {
    await browser.close().catch(() => {});
    await bb(`/sessions/${session.id}`, { method: "POST", body: JSON.stringify({ projectId, status: "REQUEST_RELEASE" }) }).catch(() => {});
  }
}
