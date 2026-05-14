import { DEEP_WILDCARD, PATH_SEGMENTS, WILDCARD } from "./constants.js";
import type { ResolvablePath, Segment } from "./types.js";

/**
 * Returns true only for strings that are the canonical representation of a
 * non-negative integer (e.g. "0", "1", "123"). Rejects "01", "1e3", "-1", etc.,
 * so that numeric-looking object keys are preserved as strings.
 */
export function isCanonicalArrayIndex(key: string): boolean {
	const num = Number(key);
	return (
		Number.isInteger(num) && num >= 0 && num < 2 ** 32 && String(num) === key
	);
}

export function resolveSegments(
	target: ResolvablePath<any>,
): readonly Segment[] {
	if (typeof target === "function") {
		const proxy = createPathProxy([]);
		const result = target(proxy) as unknown;
		return (
			((result as Record<symbol, unknown>)?.[PATH_SEGMENTS] as Segment[]) ?? []
		);
	}
	if (target != null && typeof target === "object" && "segments" in target) {
		return (target as { segments: readonly Segment[] }).segments;
	}
	return [];
}

// Returns `any` intentionally — the proxy is typed by the caller via PathExpression<T, V>
export function createPathProxy(segments: readonly Segment[]): any {
	return new Proxy(
		{ [PATH_SEGMENTS]: segments },
		{
			get(target, key) {
				if (key === PATH_SEGMENTS)
					return target[PATH_SEGMENTS as keyof typeof target];
				// Symbols (other than PATH_SEGMENTS) return undefined — not recordable segments
				if (typeof key === "symbol") return undefined;
				// Every string key becomes a new path segment
				const next: Segment = isCanonicalArrayIndex(key) ? Number(key) : key;
				return createPathProxy([...segments, next]);
			},
		},
	);
}

export function segmentsEqual(
	a: readonly Segment[],
	b: readonly Segment[],
): boolean {
	if (a.length !== b.length) return false;
	return a.every((s, i) => s === b[i]);
}

export function matchesPrefix(
	full: readonly Segment[],
	prefix: readonly Segment[],
): boolean {
	// Quick reject: only when prefix is too long even after every `**` collapses
	// to zero segments. (Each `**` can skip 0..N segments, so each one effectively
	// subtracts one from the minimum prefix length.)
	let minPrefixLen = 0;
	for (const s of prefix) if (s !== DEEP_WILDCARD) minPrefixLen++;
	if (minPrefixLen > full.length) return false;

	let p = 0;
	let f = 0;
	while (p < prefix.length) {
		if (prefix[p] === DEEP_WILDCARD) {
			if (p === prefix.length - 1) return true;
			const restPrefix = prefix.slice(p + 1);
			for (let skip = 0; f + skip <= full.length; skip++) {
				if (matchesPrefix(full.slice(f + skip), restPrefix)) return true;
			}
			return false;
		}
		if (f >= full.length) return false;
		if (prefix[p] !== WILDCARD && prefix[p] !== full[f]) return false;
		p++;
		f++;
	}
	return p === prefix.length;
}

export function patternMatches(
	pattern: readonly Segment[],
	concrete: readonly Segment[],
): boolean {
	if (pattern.length !== concrete.length) return false;
	for (let i = 0; i < pattern.length; i++) {
		if (
			pattern[i] !== WILDCARD &&
			pattern[i] !== DEEP_WILDCARD &&
			pattern[i] !== concrete[i]
		)
			return false;
	}
	return true;
}
