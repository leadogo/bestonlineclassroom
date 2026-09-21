import { test } from "node:test";
import assert from "node:assert/strict";
import { dueRules, render, toHtml } from "./reminders.ts";

const vars = { first_name: "Ana", title: "AI For Agents Masterclass", host_name: "William", join_url: "https://bestonlineclassroom.com/j/abc", replay_url: "", start_local: "7:00 PM" };

test("render fills known names and leaves unknown ones visible", () => {
  assert.equal(render("Hi {{first_name}}, {{ title }} at {{start_local}} {{nope}}", vars), "Hi Ana, AI For Agents Masterclass at 7:00 PM {{nope}}");
});

test("dueRules picks the rules whose send moment is inside the window", () => {
  const rules = [
    { key: "before50", minutes_before: 50, subject: "", body: "" },
    { key: "before30", minutes_before: 30, subject: "", body: "" },
  ];
  const start = new Date("2026-09-21T23:00:00Z");
  const at = (m: string) => new Date(`2026-09-21T${m}:00Z`);
  assert.deepEqual(dueRules(rules, start, at("22:05"), at("22:10")).map((r) => r.key), []);
  assert.deepEqual(dueRules(rules, start, at("22:10"), at("22:15")).map((r) => r.key), ["before50"]);
  assert.deepEqual(dueRules(rules, start, at("22:25"), at("22:35")).map((r) => r.key), ["before30"], "a ten-minute window from a slow tick still catches it once");
  assert.deepEqual(dueRules(rules, start, at("22:30"), at("22:35")).map((r) => r.key), ["before30"]);
});

test("toHtml makes paragraphs and links", () => {
  const html = toHtml("Hi Ana,\n\nYour link:\nhttps://x.com/j/1\n\nBye <3");
  assert.match(html, /<p[^>]*>Hi Ana,<\/p>/);
  assert.match(html, /<a href="https:\/\/x.com\/j\/1">/);
  assert.match(html, /Bye &lt;3/);
});
