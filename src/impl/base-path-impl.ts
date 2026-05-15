import { DEEP_WILDCARD, WILDCARD } from "../constants.js";
import type {
	MatchResult,
	Path,
	ResolvablePath,
	Segment,
	TemplatePath,
} from "../types.js";
import {
	hasWildcardSegment,
	matchesPrefix,
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
		return this.segments
			.map((s) =>
				s === WILDCARD ? "*" : s === DEEP_WILDCARD ? "**" : String(s),
			)
			.join(".");
	}

	startsWith(other: ResolvablePath<T>): boolean {
		return matchesPrefix(this.segments, resolveSegments(other));
	}

	covers(other: ResolvablePath<T>): boolean {
		return matchesPrefix(resolveSegments(other), this.segments);
	}

	equals(other: ResolvablePath<T>): boolean {
		return segmentsEqual(this.segments, resolveSegments(other));
	}

	match(other: ResolvablePath<T>): MatchResult | null {
		const otherSegs = resolveSegments(other);
		if (segmentsEqual(this.segments, otherSegs)) return { relation: "equals" };

		const thisHasWild = hasWildcardSegment(this.segments);
		const otherHasWild = hasWildcardSegment(otherSegs);

		// Wildcard coverage: a wildcard-bearing side covers the other when its
		// segments form a prefix-pattern of the other's segments. This includes
		// both exact matches (template fully expands to the concrete) and prefix
		// matches (template covers a region the concrete sits inside).
		// `matchesPrefix(full, prefix)` returns true exactly in those cases when
		// the prefix carries wildcards, so it unifies what `.covers()` does with
		// what `.match()` should report.
		if (thisHasWild && matchesPrefix(otherSegs, this.segments))
			return { relation: "covers" };
		if (otherHasWild && matchesPrefix(this.segments, otherSegs))
			return { relation: "covered-by" };

		// Literal parent/child: both sides must be wildcard-free. A wildcard
		// prefix is not a literal prefix.
		if (!thisHasWild && !otherHasWild) {
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
		}

		return null;
	}

	// Abstract — implementations create PathImpl or TemplatePathImpl instances which live in path-impl.ts.
	// TemplatePathImpl widens these to also allow returning a TemplatePath when the resulting
	// segments still contain wildcards.
	abstract parent(): Path<T, unknown> | TemplatePath<T, unknown> | null;
	abstract subtract<U>(
		prefix: ResolvablePath<T, U>,
	): Path<U, V> | TemplatePath<U, V> | null;
	abstract slice(
		start?: number,
		end?: number,
	): Path<T, unknown> | TemplatePath<T, unknown>;
}

// Re-export constants used by both PathImpl and TemplatePathImpl so callers
// don't need an extra import just for the wildcard check.
export { DEEP_WILDCARD, WILDCARD };
