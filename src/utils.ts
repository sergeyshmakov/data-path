import type { Segment, ResolvablePath } from "./types.js";
import { PATH_SEGMENTS, WILDCARD, DEEP_WILDCARD } from "./constants.js";

export function resolveSegments(target: ResolvablePath<any>): readonly Segment[] {
	if (typeof target === "function") {
		const proxy = createPathProxy([]);
		const result = target(proxy) as any;
		return result?.[PATH_SEGMENTS] ?? [];
	}
	if (target && typeof target === "object" && "segments" in target) {
		return target.segments;
	}
	return [];
}

export function createPathProxy(segments: readonly Segment[]): any {
	return new Proxy(
		{ [PATH_SEGMENTS]: segments },
		{
			get(target, key) {
				if (key === PATH_SEGMENTS) return target[PATH_SEGMENTS as keyof typeof target];
				if (typeof key === "string" && key !== "then" && key !== "Symbol") {
					const next: Segment = Number.isNaN(Number(key)) ? key : Number(key);
					return createPathProxy([...segments, next]);
				}
				return typeof key === "symbol" ? undefined : createPathProxy(segments);
			},
		}
	);
}

export function segmentsEqual(a: readonly Segment[], b: readonly Segment[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((s, i) => s === b[i]);
}

export function matchesPrefix(
	full: readonly Segment[],
	prefix: readonly Segment[],
): boolean {
	if (prefix.length > full.length) return false;
	let p = 0;
	let f = 0;
	while (p < prefix.length && f < full.length) {
		if (prefix[p] === DEEP_WILDCARD) {
			if (p === prefix.length - 1) return true;
			const restPrefix = prefix.slice(p + 1);
			for (let skip = 0; f + skip <= full.length; skip++) {
				if (matchesPrefix(full.slice(f + skip), restPrefix)) return true;
			}
			return false;
		}
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
		if (pattern[i] !== WILDCARD && pattern[i] !== DEEP_WILDCARD && pattern[i] !== concrete[i])
			return false;
	}
	return true;
}
