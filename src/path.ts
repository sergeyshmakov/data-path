import { PATH_SEGMENTS } from "./constants.js";
import { PathImpl } from "./impl/path-impl.js";
import type { BasePath, Path, PathExpression, Segment } from "./types.js";
import { createPathProxy, isCanonicalArrayIndex } from "./utils.js";

/**
 * Create a typed path from a lambda expression, from an existing base path, or as a root.
 *
 * @example
 * // Lambda — recommended: annotate the parameter so both T and V are inferred
 * const p = path((user: User) => user.profile.firstName);
 *
 * @example
 * // Both generics explicit
 * const p = path<User, string>((u) => u.profile.firstName);
 *
 * @example
 * // Root path (no segments) — typically extended via .to() or path(root, expr)
 * const root = path<User>();
 *
 * @example
 * // Extend an existing base path
 * const p2 = path(root, (u) => u.profile);
 */
export function path<T>(): Path<T, T>;
export function path<T, V = unknown>(expr: PathExpression<T, V>): Path<T, V>;
export function path<T, U, V = unknown>(
	base: BasePath<T, U>,
	expr: PathExpression<U, V>,
): Path<T, V>;
export function path<T, V = unknown>(
	baseOrExpr?: BasePath<T, unknown> | PathExpression<T, V>,
	expr?: PathExpression<unknown, V>,
): Path<T, V> {
	if (baseOrExpr === undefined) {
		return new PathImpl<T, V>([]);
	}

	if (typeof baseOrExpr === "function") {
		const proxy = createPathProxy([]);
		const result = (baseOrExpr as PathExpression<T, V>)(proxy);
		const segments: Segment[] =
			((result as Record<symbol, unknown>)?.[PATH_SEGMENTS] as Segment[]) ?? [];
		return new PathImpl<T, V>(segments);
	}

	const baseSegments = (baseOrExpr as BasePath<T, unknown>).segments;
	if (expr !== undefined) {
		const proxy = createPathProxy([]);
		const result = (expr as PathExpression<unknown, V>)(proxy);
		const tailSegments =
			((result as Record<symbol, unknown>)?.[PATH_SEGMENTS] as Segment[]) ?? [];
		return new PathImpl<T, V>([...baseSegments, ...tailSegments]);
	}

	return new PathImpl<T, V>(baseSegments);
}

/**
 * Create a path from a raw dot-separated string (e.g. `"users.0.name"`).
 *
 * Useful for dynamic paths from external sources (API responses, Zod issue paths, etc.).
 * Segments that are canonical non-negative integers are stored as numbers; all others as strings.
 *
 * The optional second generic `V` declares the expected leaf type without a cast:
 * ```ts
 * unsafePath<User, string>("profile.firstName").get(user)  // string | undefined
 * ```
 *
 * @param raw Dot-separated string. Empty string returns a zero-segment root path.
 */
export function unsafePath<T, V = unknown>(raw: string): Path<T, V> {
	const segments: Segment[] = raw
		? raw
				.split(".")
				.map((s) => (s === "" ? s : isCanonicalArrayIndex(s) ? Number(s) : s))
		: [];
	return new PathImpl<T, V>(segments);
}
