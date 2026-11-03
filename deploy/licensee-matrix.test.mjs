// KS_SHARED_HOSTING_v1 - deploy/licensee-matrix.mjs (node --test deploy/*.test.mjs). Same file in KS-Portal and KS-Client.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseRegistry, plan } from "./licensee-matrix.mjs";

const registry = (licensees) => JSON.stringify({ licensees });

test("the committed registry is valid", () => {
  parseRegistry(readFileSync(new URL("./licensees.json", import.meta.url), "utf8"));
});

test("web builds go to every enabled brokerage that lists the app", () => {
  const list = parseRegistry(
    registry([
      { code: "northwind", enabled: true },
      { code: "acme-cap", environment: "ks-acme", enabled: true, apps: ["server", "client"] },
      { code: "paused", enabled: false },
    ]),
  );
  assert.deepEqual(plan(list, "portal"), [{ code: "northwind", environment: "ks-northwind" }]);
  assert.deepEqual(plan(list, "client"), [
    { code: "northwind", environment: "ks-northwind" },
    { code: "acme-cap", environment: "ks-acme" },
  ]);
  assert.deepEqual(plan(list, "client", "acme-cap"), [{ code: "acme-cap", environment: "ks-acme" }]);
  assert.throws(() => plan(list, "portal", "acme-cap"), /does not list "portal"/);
  assert.throws(() => plan(list, "portal", "paused"), /disabled/);
  assert.throws(() => plan(list, "portal", "nobody"), /not in deploy\/licensees.json/);
  assert.throws(() => plan(list, "website"), /Unknown app/);
});

test("bad entries are all reported", () => {
  assert.throws(
    () => parseRegistry(registry([{ code: "A", enabled: "yes" }, { code: "ok-one", enabled: true }, { code: "ok-one", enabled: true }])),
    (err) => /code "A"/.test(err.message) && /enabled must be/.test(err.message) && /listed twice/.test(err.message),
  );
  assert.throws(() => parseRegistry("{"), /not valid JSON/);
  assert.throws(() => parseRegistry("{}"), /"licensees" array/);
});
