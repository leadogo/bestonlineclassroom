import { test } from "node:test";
import assert from "node:assert/strict";
import { mp4Info } from "./mp4.ts";

function atom(type: string, payload: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + payload.length, 0);
  head.write(type, 4, "latin1");
  return Buffer.concat([head, payload]);
}
/** mvhd version 0: version+flags(4) created(4) modified(4) timescale(4) duration(4) … */
function mvhd(timescale: number, duration: number): Buffer {
  const b = Buffer.alloc(100);
  b.writeUInt32BE(timescale, 12);
  b.writeUInt32BE(duration, 16);
  return atom("mvhd", b);
}
const readerOf = (file: Buffer) => (off: number, len: number) => file.subarray(off, Math.min(off + len, file.length));

test("faststart file: moov before mdat, duration from mvhd", () => {
  const file = Buffer.concat([atom("ftyp", Buffer.alloc(24)), atom("moov", mvhd(1000, 8385900)), atom("free", Buffer.alloc(0)), atom("mdat", Buffer.alloc(500))]);
  const info = mp4Info(readerOf(file), file.length);
  assert.deepEqual(info.atoms.map((a) => a.type), ["ftyp", "moov", "free", "mdat"]);
  assert.equal(info.faststart, true);
  assert.equal(info.durationSeconds, 8385.9);
});

test("moov after mdat is not faststart", () => {
  const file = Buffer.concat([atom("ftyp", Buffer.alloc(24)), atom("mdat", Buffer.alloc(500)), atom("moov", mvhd(600, 60000))]);
  const info = mp4Info(readerOf(file), file.length);
  assert.equal(info.faststart, false);
  assert.equal(info.durationSeconds, 100);
});
