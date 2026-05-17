/**
 * Pure-JS unit tests for `decodeHtmlEntities`.
 *
 * Run with: node --test tests/unit/decodeHtmlEntities.unit.js
 *
 * Uses node's built-in test runner (no Vitest, no extra deps). The utility
 * lives in `src/shared/decodeHtmlEntities.js` and is a pure string→string
 * function with no React or DOM dependencies, so we can import it directly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeHtmlEntities } from "../../src/shared/decodeHtmlEntities.js";

test("decodes numeric decimal entity &#8217; into a curly apostrophe", () => {
  assert.equal(
    decodeHtmlEntities("Jacob&#8217;s Island"),
    "Jacob’s Island",
  );
});

test("decodes named entity &amp;", () => {
  assert.equal(decodeHtmlEntities("Smith &amp; Co"), "Smith & Co");
});

test("decodes named entities &lt; and &gt;", () => {
  assert.equal(decodeHtmlEntities("1 &lt; 2 &gt; 0"), "1 < 2 > 0");
});

test("decodes named entity &quot;", () => {
  assert.equal(
    decodeHtmlEntities("&quot;Open House&quot;"),
    '"Open House"',
  );
});

test("decodes named entity &apos; and numeric &#039;", () => {
  assert.equal(
    decodeHtmlEntities("Owner&apos;s suite"),
    "Owner's suite",
  );
  assert.equal(
    decodeHtmlEntities("Owner&#039;s suite"),
    "Owner's suite",
  );
});

test("decodes hexadecimal entity &#x2014; (em dash)", () => {
  assert.equal(
    decodeHtmlEntities("Penthouse &#x2014; sea view"),
    "Penthouse — sea view",
  );
});

test("decodes multiple mixed entities in a single string", () => {
  assert.equal(
    decodeHtmlEntities("Smith &amp; Jacob&#8217;s &quot;Loft&quot;"),
    "Smith & Jacob’s \"Loft\"",
  );
});

test("returns a clean string unchanged (no entities → identity)", () => {
  const input = "Plain title with no entities";
  assert.equal(decodeHtmlEntities(input), input);
});

test("handles empty string and non-string inputs defensively", () => {
  assert.equal(decodeHtmlEntities(""), "");
  assert.equal(decodeHtmlEntities(null), null);
  assert.equal(decodeHtmlEntities(undefined), undefined);
  assert.equal(decodeHtmlEntities(123), 123);
});

test("only decodes one level (double-encoded &amp;#8217; stays partially encoded)", () => {
  // WordPress occasionally double-encodes. We resolve `&amp;` to `&` in a
  // single pass, leaving `&#8217;` intact — running the helper a second time
  // would finish the decode if that ever became a requirement.
  assert.equal(
    decodeHtmlEntities("Jacob&amp;#8217;s Island"),
    "Jacob&#8217;s Island",
  );
});

test("leaves unknown named entities verbatim instead of dropping them", () => {
  assert.equal(
    decodeHtmlEntities("Look at this &widget; thing"),
    "Look at this &widget; thing",
  );
});

test("decodes astral-plane code points via numeric reference", () => {
  // 0x1F600 = grinning face. Verifies String.fromCodePoint path.
  assert.equal(decodeHtmlEntities("Hello &#128512;!"), "Hello 😀!");
});

test("decodes &nbsp; into a non-breaking space (U+00A0)", () => {
  assert.equal(
    decodeHtmlEntities("Two&nbsp;words"),
    "Two words",
  );
});

test("is case-insensitive for named entities (WordPress sometimes uppercases)", () => {
  assert.equal(decodeHtmlEntities("A &AMP; B"), "A & B");
  assert.equal(decodeHtmlEntities("&LT;tag&GT;"), "<tag>");
});

test("rejects out-of-range numeric references gracefully", () => {
  // Code point > 0x10FFFF is invalid; helper leaves the entity verbatim.
  assert.equal(
    decodeHtmlEntities("Bad &#9999999999;"),
    "Bad &#9999999999;",
  );
});
