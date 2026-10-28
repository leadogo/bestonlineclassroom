import { test } from "node:test";
import assert from "node:assert/strict";
import { isCrawlerAgent, isScannerAddressRows, isScannerAgent } from "./scanner.ts";

test("isScannerAgent: a Linux desktop is a scanner; phones, ChromeOS, Windows and Mac on any Chrome build are people", () => {
  assert.equal(isScannerAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"), true);
  assert.equal(isScannerAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36"), true);
  assert.equal(isScannerAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36"), false, "Android says Linux");
  assert.equal(isScannerAgent("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36"), false, "ChromeOS says Linux");
  assert.equal(isScannerAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1"), false);
  assert.equal(isScannerAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36"), false, "current stable on Windows is a person");
  assert.equal(isScannerAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"), false);
  assert.equal(isScannerAgent(null), false);
  assert.equal(isScannerAgent(""), false);
});

test("isScannerAgent: a smart TV or a console says Linux and is a person", () => {
  assert.equal(isScannerAgent("Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36"), false);
  assert.equal(isScannerAgent("Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager"), false);
  assert.equal(isScannerAgent("Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36 CrKey/1.56.500000"), false, "a Chromecast");
  assert.equal(isScannerAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"), true, "the sandbox");
});

test("isScannerAddressRows: four different tokens from one address inside the window is a fleet; the same token four times, or three tokens, is a household (SPEC-friday-unattended.md, D)", () => {
  assert.equal(isScannerAddressRows(["aaaaaaaaaaaa", "bbbbbbbbbbbb", "cccccccccccc"], "dddddddddddd"), true);
  assert.equal(isScannerAddressRows(["aaaaaaaaaaaa", "aaaaaaaaaaaa", "aaaaaaaaaaaa", "aaaaaaaaaaaa"], "aaaaaaaaaaaa"), false);
  assert.equal(isScannerAddressRows(["aaaaaaaaaaaa", "bbbbbbbbbbbb"], "cccccccccccc"), false);
  assert.equal(isScannerAddressRows([null, "aaaaaaaaaaaa", "bbbbbbbbbbbb", "cccccccccccc"], "cccccccccccc"), false);
  assert.equal(isScannerAddressRows([], "aaaaaaaaaaaa"), false);
});

test("isScannerAgent: link-preview crawlers are scanners on any OS (Meta, Oct 28)", () => {
  assert.equal(isScannerAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0"), true);
  assert.equal(isScannerAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0 (compatible; meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler))"), true);
  assert.equal(isScannerAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0]"), false, "the Facebook in-app browser is a person");
  assert.equal(isCrawlerAgent("Mozilla/5.0 (compatible; meta-externalagent/1.1)"), true);
  assert.equal(isCrawlerAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"), false, "an email scanner still moves the row (the reminder touch)");
});
