/**
 * Decode HTML entities in a string without touching the DOM.
 *
 * WordPress' `title.rendered` arrives with entities like `&#8217;`, `&amp;`,
 * `&#039;` baked into the value. Rendering it through React shows the literal
 * `&#8217;` instead of `'`. This helper turns those entities into their
 * Unicode characters so callers can pass the result straight to JSX.
 *
 * The implementation is intentionally vanilla:
 *   - Numeric decimal references: `&#NNNN;`
 *   - Numeric hexadecimal references: `&#xHHHH;` / `&#XHHHH;`
 *   - A short named-entity table covering the ones WordPress emits in titles
 *     (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, `&nbsp;`).
 *
 * Why not `DOMParser`?
 *   - Node's `node --test` runner has no DOM and we don't want to add a
 *     jsdom/linkedom dependency just for this. A pure regex pass keeps the
 *     utility portable and trivially unit-testable.
 *
 * The function is idempotent for strings that contain no entities and
 * defensively returns non-string inputs unchanged.
 */
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const ENTITY_RE = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi;

function decodeNumeric(body) {
  // body is either "#NNN" or "#xHH"
  let codePoint;
  if (body.charAt(1) === "x" || body.charAt(1) === "X") {
    codePoint = parseInt(body.slice(2), 16);
  } else {
    codePoint = parseInt(body.slice(1), 10);
  }
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return null;
  }
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return null;
  }
}

export function decodeHtmlEntities(str) {
  if (typeof str !== "string" || str === "") return str;
  if (str.indexOf("&") === -1) return str;

  return str.replace(ENTITY_RE, (match, body) => {
    if (body.charAt(0) === "#") {
      const decoded = decodeNumeric(body);
      return decoded === null ? match : decoded;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named !== undefined ? named : match;
  });
}

export default decodeHtmlEntities;
