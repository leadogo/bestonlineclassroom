import { test } from "node:test";
import assert from "node:assert/strict";
import { isScannerAgent } from "./scanner.ts";

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
