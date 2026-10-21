import { test } from "node:test";
import assert from "node:assert/strict";
import { CHROME_STABLE, isScannerAgent } from "./scanner.ts";

test("isScannerAgent: a Linux desktop or an impossible Chrome build is a scanner; phones, ChromeOS, Windows on a real build are people", () => {
  assert.equal(isScannerAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"), true);
  assert.equal(isScannerAgent(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_STABLE + 3}.0.0.0 Safari/537.36`), true);
  assert.equal(isScannerAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0"), true);
  assert.equal(isScannerAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36"), false, "Android says Linux");
  assert.equal(isScannerAgent("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"), false, "ChromeOS says Linux");
  assert.equal(isScannerAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1"), false);
  assert.equal(isScannerAgent(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_STABLE}.0.0.0 Safari/537.36`), false);
  assert.equal(isScannerAgent(`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_STABLE + 2}.0.0.0 Safari/537.36`), false, "two above stable is a beta channel");
  assert.equal(isScannerAgent(null), false);
  assert.equal(isScannerAgent(""), false);
});
