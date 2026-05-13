import { DEEP_WILDCARD, WILDCARD } from "../constants.js";
import type { MatchResult, Path, ResolvablePath, Segment } from "../types.js";
import {
	matchesPrefix,
	patternMatches,
	resolveSegments,
	segmentsEqual,
} from "../utils.js";

/**
 * Shared structural base for PathImpl and TemplatePathImpl.
 * Contains all methods that do not depend on how a path reads, writes, or
 * creates new concrete path instances.
 */
export abstract class AbstractPathImpl<T = unknown, V = unknown> {
	readonly segments: readonly Segment[];

	constructor(segments: readonly Segment[]) {
		this.segments = segments;
	}

	get length(): number {
		return this.segments.length;
	}

	get $(): string {
		return this.toString();
	}

	toString(): string {
		return this.segments.join(".");
	}

	startsWith(other: ResolvablePath<T>): boolean {
		return matchesPrefix(this.segments, resolveSegments(other));
	}

	includes(other: ResolvablePath<T>): boolean {
		return matchesPrefix(resolveSegments(other), this.segments);
	}

	equals(other: ResolvablePath<T>): boolean {
		return segmentsEqual(this.segments, resolveSegments(other));
	}

	match(other: ResolvablePath<T>): MatchResult | null {
		const otherSegs = resolveSegments(other);
		if (segmentsEqual(this.segments, otherSegs)) return { relation: "equals" };
		if (
			matchesPrefix(this.segments, otherSegs) &&
			this.segments.length > otherSegs.length
		)
			return { relation: "child" };
		if (
			matchesPrefix(otherSegs, this.segments) &&
			otherSegs.length > this.segments.length
		)
			return { relation: "parent" };
		if (patternMatches(this.segments, otherSegs))
			return { relation: "includes" };
		if (patternMatches(otherSegs, this.segments))
			return { relation: "included-by" };
		return null;
	}

	// Abstract — implementations create PathImpl instances which live in path-impl.ts
	abstract parent(): Path<T, unknown> | null;
	abstract subtract<U>(prefix: ResolvablePath<T, U>): Path<U, V> | null;
	abstract slice(start?: number, end?: number): Path<T, unknown>;
}

// Re-export constants used by both PathImpl and TemplatePathImpl so callers
// don't need an extra import just for the wildcard check.
export { DEEP_WILDCARD, WILDCARD };
