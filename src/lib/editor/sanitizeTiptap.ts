/**
 * TipTap document sanitizer.
 *
 * Stored-XSS defense for documents that are persisted and later rendered on
 * the public, read-only `/shared/[token]` pages. A TipTap JSON document is a
 * recursive tree of nodes (each with optional `attrs`, `content`, and `marks`).
 * Several node/mark types carry user-controlled URL attributes that end up in
 * live `href`/`src` attributes when rendered:
 *
 *   - link mark / bookmark node:  `href`, `url`
 *   - image node / bookmark node: `src`, `image`, `favicon`
 *
 * If any of those hold a `javascript:`, `data:` (non-image), `vbscript:`, …
 * scheme, an attacker can plant script that executes for anyone viewing the
 * shared page. This module deep-walks the document and replaces every unsafe
 * URL value with a harmless placeholder before the JSON is stored.
 */

/** Attribute names that are treated as URLs and therefore sanitized. */
const URL_ATTRIBUTE_KEYS = new Set(["href", "url", "src", "image", "favicon"]);

/** Placeholder substituted for a blocked URL. */
const SAFE_URL_PLACEHOLDER = "#";

/**
 * Decide whether a URL string is safe to keep as a live href/src.
 *
 * Allowed:
 *   - http: / https: / mailto:
 *   - relative URLs and root-relative paths ("/foo", "foo", "./foo", "#frag",
 *     "?q=1") — i.e. anything without an explicit dangerous scheme
 *   - data:image/* (safe to render as an <img src>, never executes script)
 *
 * Blocked: javascript:, vbscript:, data:* (other than data:image/*), file:,
 * blob:, and any other explicit scheme.
 */
export function isSafeUrl(value: string): boolean {
  if (typeof value !== "string") return false;

  // Strip ASCII control chars + whitespace that browsers ignore when parsing a
  // URL scheme (e.g. "java\tscript:alert(1)", " javascript:...", newlines), so
  // an attacker cannot smuggle a dangerous scheme past the check by padding it.
  // \x00-\x20 covers the C0 control range + space; \x7f is DEL.
  const trimmed = value.replace(/[\x00-\x20\x7f]+/g, "");
  if (trimmed === "") return true; // empty → harmless

  // Does it start with an explicit "scheme:"? A scheme is [a-z][a-z0-9+.-]*
  // per RFC 3986.
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (!schemeMatch) {
    // No scheme → relative/anchor/query path. Safe.
    return true;
  }

  const scheme = schemeMatch[1].toLowerCase();

  if (scheme === "http" || scheme === "https" || scheme === "mailto") {
    return true;
  }

  // Allow inline images via data URLs, but nothing else under data:.
  if (scheme === "data") {
    return /^data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon);/i.test(
      trimmed
    );
  }

  // javascript:, vbscript:, file:, blob:, anything else → unsafe.
  return false;
}

/**
 * Sanitize a single attrs object, returning a new object with any unsafe URL
 * attributes neutralized. Returns the same reference when nothing changed.
 */
function sanitizeAttrs(
  attrs: Record<string, unknown>
): Record<string, unknown> {
  let mutated = false;
  const out: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(attrs)) {
    if (
      URL_ATTRIBUTE_KEYS.has(key) &&
      typeof val === "string" &&
      !isSafeUrl(val)
    ) {
      out[key] = SAFE_URL_PLACEHOLDER;
      mutated = true;
    } else {
      out[key] = val;
    }
  }

  return mutated ? out : attrs;
}

/**
 * Recursively sanitize a TipTap node (or any nested value). Walks `attrs`,
 * `marks`, and `content`. Returns the same reference when nothing changed so
 * callers can cheaply detect no-ops.
 */
function sanitizeNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    let mutated = false;
    const arr = node.map((child) => {
      const next = sanitizeNode(child);
      if (next !== child) mutated = true;
      return next;
    });
    return mutated ? arr : node;
  }

  if (node === null || typeof node !== "object") {
    return node;
  }

  const obj = node as Record<string, unknown>;
  let mutated = false;
  const out: Record<string, unknown> = { ...obj };

  // attrs on this node (covers link/bookmark/image url/href/src/image/favicon)
  if (obj.attrs && typeof obj.attrs === "object" && !Array.isArray(obj.attrs)) {
    const nextAttrs = sanitizeAttrs(obj.attrs as Record<string, unknown>);
    if (nextAttrs !== obj.attrs) {
      out.attrs = nextAttrs;
      mutated = true;
    }
  }

  // marks (e.g. the link mark carries href in mark.attrs)
  if (Array.isArray(obj.marks)) {
    const nextMarks = sanitizeNode(obj.marks);
    if (nextMarks !== obj.marks) {
      out.marks = nextMarks;
      mutated = true;
    }
  }

  // child content
  if (Array.isArray(obj.content)) {
    const nextContent = sanitizeNode(obj.content);
    if (nextContent !== obj.content) {
      out.content = nextContent;
      mutated = true;
    }
  }

  return mutated ? out : node;
}

/**
 * Deep-walk a TipTap JSON document and neutralize every dangerous URL
 * attribute. Non-object input is returned unchanged. The function is pure: it
 * never mutates the input, returning a structurally-shared copy with only the
 * unsafe attributes replaced.
 */
export function sanitizeTiptapDoc(doc: unknown): unknown {
  return sanitizeNode(doc);
}
