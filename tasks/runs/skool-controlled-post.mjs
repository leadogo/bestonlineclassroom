import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import * as lib from "../../src/lib/skool-broadcast.ts";
const SHOT = process.env.SHOT_DIR;
const b = lib.BROADCASTS.sunday; const CATEGORY = lib.CATEGORY ?? "Announcements";
if (!b?.title || !b?.body) throw new Error("sunday broadcast missing: " + Object.keys(lib).join(","));
console.log("posting:", JSON.stringify(b.title), "| category", CATEGORY, "| words", b.body.split(/\s+/).length);
const BB = "https://api.browserbase.com/v1";
const key = process.env.BROWSERBASE_API_KEY, projectId = process.env.BROWSERBASE_PROJECT_ID, contextId = process.env.BROWSERBASE_SKOOL_CONTEXT_ID;
const bb = async (p, init) => { const r = await fetch(`${BB}${p}`, { ...init, headers: { "X-BB-API-Key": key, "content-type": "application/json" } }); const t = await r.text(); if (!r.ok) throw new Error(`${p} ${r.status} ${t.slice(0,120)}`); return t ? JSON.parse(t) : {}; };
const session = await bb("/sessions", { method: "POST", body: JSON.stringify({ projectId, timeout: 240, browserSettings: { context: { id: contextId, persist: true }, blockAds: true } }) });
console.log("session", session.id);
const browser = await chromium.connectOverCDP(`wss://connect.browserbase.com?apiKey=${key}&sessionId=${session.id}`);
const shot = (page, n) => page.screenshot({ path: `${SHOT}/skool-${n}.png` }).catch(() => {});
const toggleColor = (page) => page.evaluate(() => { const label = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && (e.textContent ?? "").trim() === "Send email to all members"); const row = label?.parentElement; const knob = row ? Array.from(row.querySelectorAll("*")).reverse().find((e) => e.children.length <= 1 && e.getBoundingClientRect().width >= 30 && e.getBoundingClientRect().width <= 70 && e !== label) : null; return knob ? getComputedStyle(knob).backgroundColor : ""; });
const isOn = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? Number(m[2]) > Number(m[1]) + 20 && Number(m[2]) > Number(m[3]) : false; };
let postUrl = null;
try {
  const page = browser.contexts()[0].pages()[0] ?? (await browser.contexts()[0].newPage());
  // Guard: is it already there (feed or the reported-posts queue)?
  await page.goto("https://www.skool.com/bms-agent-accelerator/-/reports", { waitUntil: "domcontentloaded", timeout: 60000 }); await page.waitForTimeout(2500);
  const reports = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  if (/How many leads did you waste/i.test(reports)) throw new Error("tonight's post is in the reported queue — it DID post. Stop.");
  console.log("reports page says:", reports.replace(/\s+/g, " ").slice(0, 160));
  await page.goto("https://www.skool.com/bms-agent-accelerator", { waitUntil: "domcontentloaded", timeout: 60000 }); await page.waitForTimeout(3000);
  if (/\/login/.test(page.url())) throw new Error("login lost");
  if (await page.getByText("How many leads did you waste last month", { exact: false }).first().isVisible().catch(() => false)) throw new Error("already on the feed — stop");
  await page.getByText("Write something", { exact: false }).first().click();
  const title = page.locator('input[placeholder="Title"]'); await title.waitFor({ state: "visible", timeout: 15000 }); await title.fill(b.title);
  const editor = page.locator(".tiptap.skool-editor").first(); await editor.click(); await page.keyboard.press("ControlOrMeta+A"); await page.keyboard.press("Backspace"); await title.fill(b.title); await editor.click(); await page.waitForTimeout(300);
  for (const [i, para] of b.body.split("\n\n").entries()) { if (i > 0) { await page.keyboard.press("Enter"); await page.keyboard.press("Enter"); } await page.keyboard.insertText(para); }
  await page.waitForTimeout(800);
  await page.evaluate((label) => { for (const e of Array.from(document.querySelectorAll("*"))) if (e.children.length === 0 && (e.textContent ?? "").trim() === label) e.setAttribute("data-seen-before", "1"); }, CATEGORY);
  await page.getByText("Select a category", { exact: true }).first().click(); await page.waitForTimeout(900);
  const option = page.locator(`:text-is("${CATEGORY}"):not([data-seen-before])`).first();
  if (!(await option.isVisible().catch(() => false))) throw new Error("category menu missing");
  await option.click(); await page.waitForTimeout(600);
  if (await page.getByText("Select a category", { exact: true }).first().isVisible().catch(() => false)) throw new Error("category did not take");
  const before = await toggleColor(page);
  if (!isOn(before)) { const label = page.getByText("Send email to all members", { exact: true }).first(); await label.locator("xpath=..").locator("*").last().click().catch(async () => { await label.click(); }); await page.waitForTimeout(600); }
  const after = await toggleColor(page);
  console.log("email toggle colour before/after:", before, "/", after, "→", isOn(after) ? "on" : "NOT confirmed");
  if (!isOn(after)) throw new Error("email toggle not on");
  await shot(page, "1-filled"); console.log("title field:", JSON.stringify(await title.inputValue()), "| body chars:", (await editor.innerText()).length);
  const buttons = await page.evaluate(() => Array.from(document.querySelectorAll("button")).map(x => (x.textContent || "").trim()).filter(t => t && t.length < 30));
  console.log("buttons on page:", JSON.stringify(buttons));
  await page.locator("button", { hasText: /^post$/i }).first().click();
  await page.waitForTimeout(3000);
  await shot(page, "2-after-post-click");
  const dialogText = await page.evaluate(() => { const d = document.querySelector('[role="dialog"], [role="alertdialog"]'); return d ? d.innerText.slice(0, 600) : ""; });
  const buttons2 = await page.evaluate(() => Array.from(document.querySelectorAll("button")).map(x => (x.textContent || "").trim()).filter(t => t && t.length < 30));
  console.log("after Post click → url:", page.url(), "| dialog:", JSON.stringify(dialogText.replace(/\s+/g, " ").slice(0, 400)), "| buttons:", JSON.stringify(buttons2));
  const titleStill = await title.isVisible().catch(() => false);
  console.log("composer title field still visible:", titleStill);
  // A confirm about emailing everyone: click the confirming button once, never anything destructive.
  const confirm = page.getByRole("button", { name: /^confirm$/i }).first();
  const modalText = await page.getByText("Send email to all members?", { exact: true }).first().locator("xpath=..").innerText().catch(() => "");
  console.log("confirm modal:", JSON.stringify(modalText.replace(/\s+/g, " ").slice(0, 200)));
  if (titleStill && /are you sure you want to proceed/i.test(modalText) && (await confirm.isVisible().catch(() => false))) { console.log("clicking confirm:", await confirm.textContent()); await confirm.click(); await page.waitForTimeout(3000); await shot(page, "3-after-confirm"); }
  for (let i = 0; i < 12 && !postUrl; i++) {
    if (/skool\.com\/bms-agent-accelerator\/[a-z0-9-]+/.test(page.url()) && !/\/-\//.test(page.url())) { postUrl = page.url(); break; }
    const t = page.getByText("How many leads did you waste last month", { exact: false }).first();
    if (await t.isVisible().catch(() => false)) { await t.click().catch(() => {}); await page.waitForTimeout(2500); postUrl = /bms-agent-accelerator\/[a-z0-9-]+/.test(page.url()) ? page.url() : "posted (url not captured)"; break; }
    await page.waitForTimeout(2500);
  }
  await shot(page, "4-final");
  console.log("RESULT:", postUrl ? `POSTED ${postUrl}` : "NOT POSTED", "| final url", page.url());
} catch (e) { console.log("STOPPED:", e.message); }
finally { await browser.close().catch(() => {}); await bb(`/sessions/${session.id}`, { method: "POST", body: JSON.stringify({ projectId, status: "REQUEST_RELEASE" }) }).catch(() => {}); }
if (postUrl) {
  const db = createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await db.from("skool_broadcasts").update({ status: "posted", post_url: postUrl.startsWith("http") ? postUrl : null, error: null }).eq("broadcast_date", "2026-10-18").eq("status", "failed").select("id");
  console.log("db row updated:", error?.message ?? data?.length);
}
