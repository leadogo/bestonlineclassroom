import { test } from "node:test";
import assert from "node:assert/strict";
import { asksMarket, codeOf, findMarkets, findStates, isStateMarket, marketDraft, normalizeMarkets, onlyStates, placeOf, rollup, rollupDraft } from "./market-answer.ts";

const M = (name: string, clients: number, live = clients) => ({ name, clients, live });
const markets = [
  M("Calgary, AB", 42, 20), M("Chicago, IL", 5), M("Chicagoland, IL", 0), M("Bay Area, CA", 1), M("San Francisco, CA", 9, 8), M("Los Angeles, CA", 10, 7),
  M("Coquitlam, BC", 0), M("Central New Jersey, NJ", 2), M("Central, NJ", 0), M("Hoboken, NJ", 1), M("South Jersey,NJ", 1), M("Aurora, CO", 3), M("Aurora, ON", 1), M("Alabama, AL", 2),
  M("Florida, FL", 8, 5), M("Tampa, FL", 7), M("Ontario, ON", 5), M("Kitchener, ON", 6), M("Durham, ON", 10), M("Ottawa, ON", 16), M("Ottawa County, MI", 1), M("Tulsa County, OK", 1), M("Oklahoma City, OK", 5),
  M("Washington, MO", 1), M("Montreal, QC", 21), M("Philedelphia,PA", 3), M("Dallas, TX", 10), M("Fort Worth, TX", 4), M("Orange County, CA", 9), M("Orange, CT", 1), M("Charlotte, NC", 6),
];
const names = (hits: ReturnType<typeof findMarkets>) => hits.map((h) => h.name);

test("findMarkets: the place name whole, in any case, accent or punctuation; exact and longest first, then the busiest", () => {
  assert.deepEqual(names(findMarkets("calgary", markets)), ["Calgary, AB"]);
  assert.deepEqual(names(findMarkets("yes chicago far south suburbs", markets)), ["Chicago, IL"]);
  assert.deepEqual(names(findMarkets("Chicagoland!", markets)), ["Chicagoland, IL"]);
  assert.deepEqual(names(findMarkets("San Francisco Bay area", markets)), ["San Francisco, CA", "Bay Area, CA"]);
  assert.deepEqual(names(findMarkets("Coquitlam BC", markets)), ["Coquitlam, BC"]);
  assert.deepEqual(names(findMarkets("central new jersey", markets)), ["Central New Jersey, NJ", "Central, NJ"]);
  assert.deepEqual(names(findMarkets("New Jersey... But South Jersey", markets)), ["South Jersey,NJ"]);
  assert.deepEqual(names(findMarkets("Aurora", markets)), ["Aurora, CO", "Aurora, ON"]);
  assert.deepEqual(names(findMarkets("Montréal", markets)), ["Montreal, QC"]);
  assert.deepEqual(names(findMarkets("Babcock Ranch charlotte county", markets)), [], "a county is not the city of that name");
  assert.deepEqual(names(findMarkets("Alachua County FL", [M("Alachua County, FL", 1)])), ["Alachua County, FL"]);
  assert.deepEqual(names(findMarkets("Tulsa Oklahoma", markets)), ["Tulsa County, OK"], "a county market answers its bare name");
  assert.deepEqual(names(findMarkets("Ottawa", markets)), ["Ottawa, ON", "Ottawa County, MI"], "the exact name before a county's bare name");
  assert.deepEqual(names(findMarkets("orange county", markets)), ["Orange County, CA"]);
  assert.deepEqual(names(findMarkets("Kansas City", [M("Kansas City, MO", 6)])), ["Kansas City, MO"], "the state inside a city's name is not a state");
  assert.deepEqual(names(findMarkets("Oahu hawaii", [M("Honolulu, HI", 1)])), ["Honolulu, HI"]);
  assert.deepEqual(names(findMarkets("", markets)), []);
});

test("findMarkets: a state in the text rules out same-named cities elsewhere; state-level labels never match as cities", () => {
  assert.deepEqual(names(findMarkets("Durham NC", markets)), []);
  assert.deepEqual(names(findMarkets("Aurora CO", markets)), ["Aurora, CO"]);
  assert.deepEqual(names(findMarkets("Kitchener ,ontario, canada?", markets)), ["Kitchener, ON"]);
  assert.deepEqual(names(findMarkets("Cape Coral Florida?", markets)), []);
  assert.deepEqual(names(findMarkets("Washington state", markets)), [], "Washington, MO reads as the state, so it never answers a city question");
  assert.equal(isStateMarket("Florida, FL"), true);
  assert.equal(isStateMarket("Kitchener, ON"), false);
  assert.equal(codeOf("South Jersey,NJ"), "NJ");
});

test("findMarkets: what people actually type for a city", () => {
  assert.deepEqual(names(findMarkets("LA", markets)), ["Los Angeles, CA"]);
  assert.deepEqual(names(findMarkets("West Covina, LA, CA", markets)), ["Los Angeles, CA"]);
  assert.deepEqual(names(findMarkets("sf", markets)), ["San Francisco, CA"]);
  assert.deepEqual(names(findMarkets("Philly", markets)), ["Philedelphia,PA"], "the directory's own spelling");
  assert.deepEqual(names(findMarkets("DFW", markets)), ["Dallas, TX", "Fort Worth, TX"]);
  assert.deepEqual(names(findMarkets("the Bay", markets)), ["Bay Area, CA"]);
});

test("findStates and onlyStates: a bare state or province, by name, nickname or code; a city with a state is not bare", () => {
  assert.deepEqual(findStates("Maryland"), ["MD"]);
  assert.deepEqual(findStates("PA & NJ"), ["PA", "NJ"]);
  assert.deepEqual(findStates("MAss"), ["MA"]);
  assert.deepEqual(findStates("woodstock ont"), ["ON"]);
  assert.deepEqual(findStates("pleasant hill ca"), ["CA"]);
  assert.deepEqual(findStates("Bolton, on"), ["ON"]);
  assert.deepEqual(findStates("Nashville, TN"), ["TN"]);
  assert.deepEqual(findStates("I'm in"), [], "IN the word");
  assert.deepEqual(findStates("BOOKED ON FRIDAY"), [], "ON the word");
  assert.deepEqual(findStates("see you at 5pm MT"), [], "MT the timezone");
  assert.deepEqual(findStates("Booked"), []);
  assert.deepEqual(findStates("Washington DC?"), ["DC"], "not Washington state");
  assert.deepEqual(findStates("Washington DC / Southern MD"), ["DC", "MD"]);
  assert.equal(onlyStates("Maryland", ["MD"]), true);
  assert.equal(onlyStates("how many in Ontario?", ["ON"]), true);
  assert.equal(onlyStates("PA & NJ", ["PA", "NJ"]), true);
  assert.equal(onlyStates("Anyone in Oregon yet?", ["OR"]), true);
  assert.equal(onlyStates("I booked. North Carolina?", ["NC"]), true);
  assert.equal(onlyStates("many in eastern Tennessee?", ["TN"]), false, "a region of a state is not the state");
  assert.equal(onlyStates("South Florida", ["FL"]), false);
  assert.equal(onlyStates("Cape Coral Florida?", ["FL"]), false);
  assert.equal(onlyStates("Nashville, TN", ["TN"]), false);
});

test("rollup: every market in the state summed, state-level labels included, busiest first", () => {
  const nj = rollup("NJ", markets);
  assert.equal(nj.name, "New Jersey");
  assert.equal(nj.clients, 4);
  assert.deepEqual(nj.markets.map((m) => m.name), ["Central New Jersey, NJ", "Hoboken, NJ", "South Jersey,NJ", "Central, NJ"]);
  assert.equal(rollup("FL", markets).clients, 15);
  assert.equal(rollup("MO", markets).clients, 1);
  assert.equal(rollup("WY", markets).clients, 0);
  assert.equal(rollupDraft([nj], () => 0), "weve got 4 in New Jersey youre good");
  assert.equal(rollupDraft([rollup("PA", markets), nj]), "3 in Pennsylvania and 4 in New Jersey so youre good");
});

test("asksMarket: a market question with no directory match still gets the none-there chip", () => {
  assert.equal(asksMarket("in Georgia how many agents here"), true);
  assert.equal(asksMarket("Marin County, CA"), true);
  assert.equal(asksMarket("Can you check Tulsa Oklahoma area"), true);
  assert.equal(asksMarket("Nashville, TN"), true);
  assert.equal(asksMarket("pleasant hill ca"), true);
  assert.equal(asksMarket("DC"), true);
  assert.equal(asksMarket("Booked and Sellers for me"), false);
  assert.equal(asksMarket("How many hours should I work per day"), false);
  assert.equal(asksMarket("Or market is so bad right now"), false);
  assert.equal(asksMarket("hi from Tulsa"), false);
  assert.equal(asksMarket("Yes"), false);
  assert.equal(asksMarket("What is the cost?"), false);
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
