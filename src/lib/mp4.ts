// Two facts about an MP4 before it is uploaded: whether `moov` (the index) comes before `mdat` (the frames), so a
// browser can seek to any offset before the file has downloaded, and how long the video is (from `mvhd`).
// Written against a "read bytes at offset" function so a test can use a Buffer.

export type Atom = { type: string; offset: number; size: number };
export type Mp4Info = { atoms: Atom[]; faststart: boolean; durationSeconds: number | null };

export type ReadAt = (offset: number, length: number) => Uint8Array;

/** Top-level atoms, in file order. Handles 64-bit sizes and a size-0 last atom. */
export function readAtoms(readAt: ReadAt, fileSize: number, max = 32): Atom[] {
  const atoms: Atom[] = [];
  let off = 0;
  while (off + 8 <= fileSize && atoms.length < max) {
    const head = Buffer.from(readAt(off, 16));
    let size = head.readUInt32BE(0);
    const type = head.toString("latin1", 4, 8);
    if (size === 1) size = Number(head.readBigUInt64BE(8));
    if (size === 0) size = fileSize - off;
    if (size < 8) break;
    atoms.push({ type, offset: off, size });
    off += size;
  }
  return atoms;
}

/** Duration from the `mvhd` box inside `moov` (version 0 or 1). Null if not found in the first 64 KB of moov. */
export function readDuration(readAt: ReadAt, moov: Atom): number | null {
  const buf = Buffer.from(readAt(moov.offset, Math.min(moov.size, 65536)));
  const i = buf.indexOf("mvhd", 8, "latin1");
  if (i < 0) return null;
  const version = buf[i + 4];
  const timescale = version === 1 ? buf.readUInt32BE(i + 24) : buf.readUInt32BE(i + 16);
  const duration = version === 1 ? Number(buf.readBigUInt64BE(i + 28)) : buf.readUInt32BE(i + 20);
  return timescale ? duration / timescale : null;
}

export function mp4Info(readAt: ReadAt, fileSize: number): Mp4Info {
  const atoms = readAtoms(readAt, fileSize);
  const moov = atoms.find((a) => a.type === "moov");
  const mdat = atoms.find((a) => a.type === "mdat");
  const faststart = Boolean(moov && mdat && moov.offset < mdat.offset);
  return { atoms, faststart, durationSeconds: moov ? readDuration(readAt, moov) : null };
}
