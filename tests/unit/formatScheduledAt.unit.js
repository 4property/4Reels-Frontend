/**
 * Pure-JS unit tests for `formatScheduledAt`.
 *
 * Run with: node --test tests/unit/formatScheduledAt.unit.js
 *
 * Uses node's built-in test runner (no Vitest, no extra deps). The utility
 * lives in `src/shared/formatScheduledAt.js` and is a pure
 * string → (string | null) function with no React / DOM dependencies, so
 * we can import it directly.
 *
 * Determinism: every test that asserts a specific clock value passes an
 * explicit `timeZone` (IANA) so the result does not depend on the host
 * TZ. The component-side default of "browser TZ" is exercised by the
 * Playwright smoke instead.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatScheduledAt } from "../../src/shared/formatScheduledAt.js";

test("formats an ISO UTC timestamp in UTC with dd/mm/yyyy a las HH:MM", () => {
  assert.equal(
    formatScheduledAt("2026-05-15T09:00:00Z", { timeZone: "UTC" }),
    "15/05/2026 a las 09:00",
  );
});

test("zero-pads single-digit day, month, hour, minute", () => {
  assert.equal(
    formatScheduledAt("2026-01-05T07:08:00Z", { timeZone: "UTC" }),
    "05/01/2026 a las 07:08",
  );
});

test("shifts UTC to Europe/Dublin (DST applies +1)", () => {
  // 2026-05-15T09:00:00Z in Europe/Dublin (BST) is 10:00 local.
  assert.equal(
    formatScheduledAt("2026-05-15T09:00:00Z", { timeZone: "Europe/Dublin" }),
    "15/05/2026 a las 10:00",
  );
});

test("shifts UTC to America/New_York (-04 in May)", () => {
  // 2026-05-15T09:00:00Z in America/New_York (EDT) is 05:00 local.
  assert.equal(
    formatScheduledAt("2026-05-15T09:00:00Z", { timeZone: "America/New_York" }),
    "15/05/2026 a las 05:00",
  );
});

test("rolls the date back when the TZ shift crosses midnight", () => {
  // 2026-05-15T01:00:00Z in America/Los_Angeles (PDT) is 2026-05-14 18:00.
  assert.equal(
    formatScheduledAt("2026-05-15T01:00:00Z", { timeZone: "America/Los_Angeles" }),
    "14/05/2026 a las 18:00",
  );
});

test("returns null for null / undefined / empty string", () => {
  assert.equal(formatScheduledAt(null), null);
  assert.equal(formatScheduledAt(undefined), null);
  assert.equal(formatScheduledAt(""), null);
});

test("returns null for non-string inputs (numbers, objects, booleans)", () => {
  assert.equal(formatScheduledAt(1747299600), null);
  assert.equal(formatScheduledAt({ iso: "2026-05-15T09:00:00Z" }), null);
  assert.equal(formatScheduledAt(true), null);
  assert.equal(formatScheduledAt(false), null);
});

test("returns null for unparseable strings (does not throw)", () => {
  assert.equal(formatScheduledAt("not-a-date"), null);
  assert.equal(formatScheduledAt("2026-13-99T99:99:99Z"), null);
  assert.equal(formatScheduledAt("hello world"), null);
});

test("accepts an offset suffix and normalises to UTC", () => {
  // 09:00+02:00 == 07:00Z. Formatting in UTC must produce 07:00.
  assert.equal(
    formatScheduledAt("2026-05-15T09:00:00+02:00", { timeZone: "UTC" }),
    "15/05/2026 a las 07:00",
  );
});

test("formats midnight UTC as 00:00 (not 24:00)", () => {
  assert.equal(
    formatScheduledAt("2026-05-15T00:00:00Z", { timeZone: "UTC" }),
    "15/05/2026 a las 00:00",
  );
});
