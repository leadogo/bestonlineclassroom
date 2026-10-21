import { test } from "node:test";
import assert from "node:assert/strict";
import { pageAll } from "./db.ts";

test("pageAll: reads page after page until an empty one, whatever the server's row cap (Oct 21: 1,000 of 1,688 rows were read and nobody knew)", async () => {
  const rows = Array.from({ length: 2003 }, (_, i) => i);
  const calls: Array<[number, number]> = [];
  const make = (cap: number) => async (from: number, to: number) => { calls.push([from, to]); return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null }; };
  assert.equal((await pageAll(make(1000))).length, 2003);
  assert.deepEqual(calls.map(([f]) => f), [0, 1000, 2000, 2003], "the last page is empty");
  calls.length = 0;
  assert.equal((await pageAll(make(500))).length, 2003, "a server cap below the page size still reads everything");
  assert.equal((await pageAll(async () => ({ data: [], error: null }))).length, 0);
  await assert.rejects(pageAll(async () => ({ data: null, error: { message: "boom" } })), /boom/);
});
