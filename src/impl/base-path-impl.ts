import { DEEP_WILDCARD, WILDCARD } from "../constants.js";
import type {
	MatchResult,
	Path,
	ResolvablePath,
	Segment,
	TemplatePath,
} from "../types.js";
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

	covers(other: ResolvablePath<T>): boolean {
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
		if (patternMatches(this.segments, otherSegs)) return { relation: "covers" };
		if (patternMatches(otherSegs, this.segments))
			return { relation: "covered-by" };
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
