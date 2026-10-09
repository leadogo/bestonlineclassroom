import { test } from "node:test";
import assert from "node:assert/strict";
import { asksMarket, findMarkets, isStateMarket, marketDraft, normalizeMarkets, pickTop, placeOf } from "./market-answer.ts";

const M = (name: string, clients: number, live = clients) => ({ name, clients, live });
const markets = [
  M("Calgary, AB", 42, 20), M("Chicago, IL", 5), M("Chicagoland, IL", 0), M("Bay Area, CA", 1), M("San Francisco, CA", 9, 8),
  M("Coquitlam, BC", 0), M("Central New Jersey, NJ", 2), M("Central, NJ", 0), M("Aurora, CO", 3), M("Aurora, ON", 1), M("Alabama, AL", 2),
  M("Florida, FL", 8, 5), M("Ontario, ON", 5), M("Kitchener, ON", 6),
];

test("state-level labels sort after cities and only answer a message that is just the state", () => {
  assert.equal(isStateMarket("Florida, FL"), true);
  assert.equal(isStateMarket("Kitchener, ON"), false);
  assert.equal(isStateMarket("Washington, MO"), false);
  assert.equal(isStateMarket("Washington, WA"), true);
  assert.deepEqual(names(findMarkets("Kitchener ,ontario, canada?", markets)), ["Kitchener, ON", "Ontario, ON"]);
  assert.equal(pickTop("Kitchener ,ontario, canada?", findMarkets("Kitchener ,ontario, canada?", markets))?.name, "Kitchener, ON");
  assert.equal(pickTop("Cape Coral Florida?", findMarkets("Cape Coral Florida?", markets)), undefined);
  assert.equal(pickTop("Florida", findMarkets("Florida", markets))?.name, "Florida, FL");
  assert.equal(pickTop("how many in Ontario?", findMarkets("how many in Ontario?", markets))?.name, "Ontario, ON");
  assert.equal(pickTop("Ohio", []), undefined);
});
const names = (hits: ReturnType<typeof findMarkets>) => hits.map((h) => h.name);

test("findMarkets: the place name whole, in any case or punctuation; longest place first, then the busiest", () => {
  assert.deepEqual(names(findMarkets("Charlotte NC", markets)), []);
  assert.deepEqual(names(findMarkets("calgary", markets)), ["Calgary, AB"]);
  assert.deepEqual(names(findMarkets("yes chicago far south suburbs", markets)), ["Chicago, IL"]);
  assert.deepEqual(names(findMarkets("Chicagoland!", markets)), ["Chicagoland, IL"]);
  assert.deepEqual(names(findMarkets("San Francisco Bay area", markets)), ["San Francisco, CA", "Bay Area, CA"]);
  assert.deepEqual(names(findMarkets("Coquitlam BC", markets)), ["Coquitlam, BC"]);
  assert.deepEqual(names(findMarkets("central new jersey", markets)), ["Central New Jersey, NJ", "Central, NJ"]);
  assert.deepEqual(names(findMarkets("Aurora", markets)), ["Aurora, CO", "Aurora, ON"]);
  assert.deepEqual(names(findMarkets("in Georgia how many agents here", markets)), []);
  assert.deepEqual(names(findMarkets("Babcock Ranch charlotte county", [...markets, M("Charlotte, NC", 6)])), []);
  assert.deepEqual(names(findMarkets("Alachua County FL", [M("Alachua County, FL", 1)])), ["Alachua County, FL"]);
  assert.deepEqual(names(findMarkets("", markets)), []);
});

test("asksMarket: a market question with no market name still gets a chip", () => {
  assert.equal(asksMarket("in Georgia how many agents here"), true);
  assert.equal(asksMarket("Marin County, CA"), true);
  assert.equal(asksMarket("Can you check Tulsa Oklahoma area"), true);
  assert.equal(asksMarket("Booked and Sellers for me"), false);
  assert.equal(asksMarket("hi from Tulsa"), false);
});

test("marketDraft: Kevin's bands, the number and place swapped in", () => {
  const first = () => 0;
  const last = () => 0.999;
  assert.equal(marketDraft("Calgary, AB", 42, first), "about 40 in Calgary area, we have markets with over 50+ and its fine");
  assert.equal(marketDraft("Calgary, AB", 42, last), "weve got 42 in Calgary, no saturation experienced as of yet so youre good");
  assert.equal(marketDraft("Edmonton, AB", 110, first), "we got tons in Edmonton! over 100, but no saturation experienced as of yet");
  assert.equal(marketDraft("Atlanta, GA", 10, first), "weve got 10 in Atlanta, youre good");
  assert.equal(marketDraft("Chicago, IL", 5, first), "weve got 5 in Chicago youre good");
  assert.equal(marketDraft("Honolulu, HI", 1, first), "just 1 in Honolulu so youre good");
  assert.equal(marketDraft("Coquitlam, BC", 0, first), "none in Coquitlam yet so youre good");
  assert.equal(placeOf("Central New Jersey, NJ"), "Central New Jersey");
});

test("normalizeMarkets: names trimmed, counts whole and non-negative, blanks and duplicates dropped", () => {
  assert.deepEqual(normalizeMarkets([{ name: " Calgary, AB ", clients: "42", live: 20.7 }, { name: "", clients: 1 }, { name: "Calgary, AB", clients: 43, live: -1 }, null]), [
    { name: "Calgary, AB", clients: 43, live: 0 },
  ]);
  assert.deepEqual(normalizeMarkets("nope"), []);
});
