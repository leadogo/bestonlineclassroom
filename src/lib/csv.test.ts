import { test } from "node:test";
import assert from "node:assert/strict";
import { distinctNames, parseChatCsv, parseCsv, parseTimestamp } from "./csv.ts";

test("timestamps: h:mm:ss, mm:ss, garbage", () => {
  assert.equal(parseTimestamp("0:00:33"), 33);
  assert.equal(parseTimestamp("1:14:20"), 4460);
  assert.equal(parseTimestamp("12:05"), 725);
  assert.equal(parseTimestamp("2:19:45"), 8385);
  assert.equal(parseTimestamp("noon"), null);
  assert.equal(parseTimestamp(""), null);
});

test("csv: quoted commas, doubled quotes, CRLF, BOM, blank line", () => {
  const text = '﻿HH:MM:SS,Name,Role,Message\r\n0:00:33,Connor,Attendee,"Cookeville, TN"\r\n\r\n0:00:37,"Chris ""CH"" Hrista",Attendee,Toronto\n';
  assert.deepEqual(parseCsv(text), [
    ["HH:MM:SS", "Name", "Role", "Message"],
    ["0:00:33", "Connor", "Attendee", "Cookeville, TN"],
    ["0:00:37", 'Chris "CH" Hrista', "Attendee", "Toronto"],
  ]);
});

test("parseChatCsv: header by name, ordered by offset, empties dropped", () => {
  const text = "HH:MM:SS,Name,Role,Message\n1:14:20,Zippy,Attendee,replay?\n0:00:33,Connor,Attendee,Cookeville TN\n0:00:40,Nobody,Attendee,\n0:00:41,,Attendee,hi\nbad,Connor,Attendee,x\n";
  const rows = parseChatCsv(text);
  assert.deepEqual(rows, [
    { offset_seconds: 33, name: "Connor", body: "Cookeville TN" },
    { offset_seconds: 4460, name: "Zippy", body: "replay?" },
  ]);
  assert.deepEqual(distinctNames([...rows, { offset_seconds: 5000, name: "Connor", body: "again" }]), ["Connor", "Zippy"]);
  assert.throws(() => parseChatCsv("a,b,c\n1,2,3\n"), /header/);
});
