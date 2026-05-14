export const PATH_SEGMENTS = Symbol("PATH_SEGMENTS");

/**
 * Sentinel for a single-level wildcard segment (`each`).
 *
 * Stored as a unique Symbol — NOT the string `"*"` — so that a legitimate
 * object key named `"*"` is preserved as a literal segment and never
 * reinterpreted as a wildcard by `.get`, `.expand`, `.covers`, `.match`, etc.
 *
 * Renders as `"*"` in `toString()` / `.$` for dot-notation compatibility.
 */
export const WILDCARD: unique symbol = Symbol("WILDCARD");

/**
 * Sentinel for a deep wildcard segment (`deep`).
 *
 * Same rationale as {@link WILDCARD}: stored as a unique Symbol so the
 * literal string `"**"` remains a valid (literal) object key.
 *
 * Renders as `"**"` in `toString()` / `.$`.
 */
export const DEEP_WILDCARD: unique symbol = Symbol("DEEP_WILDCARD");
