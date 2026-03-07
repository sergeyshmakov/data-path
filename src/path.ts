import { PATH_SEGMENTS } from "./constants.js";
import { PathImpl, setTemplatePathCtor } from "./impl/path-impl.js";
import { TemplatePathImpl } from "./impl/template-path-impl.js";
import type { BasePath, Path, PathExpression, Segment } from "./types.js";
import { createPathProxy, isCanonicalArrayIndex } from "./utils.js";

setTemplatePathCtor(TemplatePathImpl);

/**
 * Create a typed path from a lambda expression or extend an existing base path.
 *
 * This function serves as the primary entry point for constructing paths. By utilizing
 * a Proxy-based builder (the lambda expression), it captures property accesses and
 * records them as path segments without needing to evaluate actual data.
 *
 * @example
 * // Create a root path
 * const root = path<User>();
 *
 * @example
 * // Create a path via lambda
 * const p = path<User>((u) => u.address.city);
 *
 * @example
 * // Extend an existing path
 * const p2 = path(root, (u) => u.profile);
 */
export function path<T>(): Path<T, T, "">;
export function path<T, V = unknown>(
	expr: PathExpression<T, V>,
): Path<T, V, string>;
export function path<T, U, V = unknown>(
	base: BasePath<T, U, string>,
	expr: PathExpression<U, V>,
): Path<T, V, string>;
export function path<T, V = unknown>(
	baseOrExpr?: BasePath<T, unknown, string> | PathExpression<T, V>,
	expr?:
		| PathExpression<unknown, V>
		| { segments: readonly Segment[] }
		| unknown,
): Path<T, V, string> {
	if (!baseOrExpr) {
		return new PathImpl<T, V, string>([]);
	}

	if (typeof baseOrExpr === "function") {
		const proxy = createPathProxy([]);
		const result = (baseOrExpr as PathExpression<T, V>)(proxy);
		const segments: Segment[] =
			((result as Record<symbol, unknown>)?.[PATH_SEGMENTS] as Segment[]) ?? [];
		return new PathImpl<T, V, string>(segments);
	}

	const baseSegments = (baseOrExpr as BasePath<T, unknown, string>).segments;
	if (expr) {
		if (typeof expr === "function") {
			const proxy = createPathProxy([]);
			const result = (expr as PathExpression<unknown, V>)(proxy);
			const tailSegments =
				((result as Record<symbol, unknown>)?.[PATH_SEGMENTS] as Segment[]) ??
				[];
			return new PathImpl<T, V, string>([...baseSegments, ...tailSegments]);
		} else if (typeof expr === "object" && "segments" in expr) {
			return new PathImpl<T, V, string>([
				...baseSegments,
				...(expr as { segments: readonly Segment[] }).segments,
			]);
		}
	}

	return new PathImpl<T, V, string>(baseSegments as Segment[]);
}

/**
 * Create a path from a raw string (e.g., "users.0.name").
 *
 * This is useful when paths are dynamic (like from a database or API response).
 * Type checking on individual segments is bypassed, and segments are automatically
 * parsed into numeric indices where appropriate.
 *
 * @param raw The dot-separated path string.
 * @returns A Path object representing the given string.
 */
export function unsafePath<T>(raw: string): Path<T, unknown, string> {
	const segments: Segment[] = raw
		? raw
				.split(".")
				.map((s) => (s === "" ? s : isCanonicalArrayIndex(s) ? Number(s) : s))
		: [];
	return new PathImpl<T, unknown, string>(segments);
}
