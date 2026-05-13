import { DEEP_WILDCARD, PATH_SEGMENTS, WILDCARD } from "../constants.js";
import type {
	BasePath,
	CollectionItem,
	MatchResult,
	Path,
	ResolvablePath,
	Segment,
	TemplatePath,
	TraversablePathMethods,
} from "../types.js";
import {
	createPathProxy,
	matchesPrefix,
	patternMatches,
	resolveSegments,
	segmentsEqual,
} from "../utils.js";

// ---------------------------------------------------------------------------
// PathImpl — concrete path with no wildcards
// ---------------------------------------------------------------------------

export class PathImpl<T = unknown, V = unknown>
	implements BasePath<T, V>, TraversablePathMethods<T, V>
{
	readonly segments: readonly Segment[];

	/**
	 * Pre-bound accessor. Assigned in the constructor so `this.get` resolves
	 * to the correct overridden version at call time (including TemplatePathImpl).
	 */
	readonly fn: (data: T) => V | undefined;

	constructor(segments: readonly Segment[]) {
		this.segments = segments;
		// Assign fn once; the closure captures `this`, so overridden get() is called correctly.
		this.fn = (data: T) => this.get(data);
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

	get(data: T): V | undefined {
		let current: unknown = data;
		for (const seg of this.segments) {
			if (current == null) return undefined;
			current = (current as Record<string | number, unknown>)[seg];
		}
		return current as V | undefined;
	}

	set(data: T, value: V): T {
		if (this.segments.length === 0) return value as unknown as T;

		const setAt = (
			obj: unknown,
			segs: readonly Segment[],
			val: unknown,
		): unknown => {
			if (segs.length === 1) {
				const key = segs[0];
				if (Array.isArray(obj)) {
					const arr = [...obj];
					arr[key as number] = val;
					return arr;
				}
				return { ...(obj as object), [key]: val };
			}
			const [first, ...rest] = segs;
			const baseObj = obj as Record<string | number, unknown>;
			const next = baseObj[first];
			const nextCopy =
				next != null && typeof next === "object"
					? Array.isArray(next)
						? [...next]
						: { ...next }
					: typeof rest[0] === "number"
						? []
						: {};
			if (Array.isArray(baseObj)) {
				const arr = [...baseObj];
				arr[first as number] = setAt(nextCopy, rest, val) as never;
				return arr;
			}
			return { ...baseObj, [first]: setAt(nextCopy, rest, val) };
		};

		const baseObj =
			typeof data === "object" && data !== null
				? Array.isArray(data)
					? [...data]
					: { ...data }
				: data;
		return setAt(baseObj, this.segments, value) as T;
	}

	update(data: T, updater: (current: V | undefined) => V): T {
		return this.set(data, updater(this.get(data)));
	}

	parent(): Path<T, unknown> | null {
		if (this.segments.length === 0) return null;
		return new PathImpl<T, unknown>(
			this.segments.slice(0, -1),
		) as unknown as Path<T, unknown>;
	}

	each<U = CollectionItem<V>>(
		expr?: (item: CollectionItem<V>) => U,
	): TemplatePath<T, U> {
		const tail = expr ? evalExpr(expr as (p: unknown) => unknown) : [];
		return new TemplatePathImpl<T, U>([
			...this.segments,
			WILDCARD,
			...tail,
		]) as unknown as TemplatePath<T, U>;
	}

	deep<U = V>(expr?: (leaf: V) => U): TemplatePath<T, U> {
		const tail = expr ? evalExpr(expr as (p: unknown) => unknown) : [];
		return new TemplatePathImpl<T, U>([
			...this.segments,
			DEEP_WILDCARD,
			...tail,
		]) as unknown as TemplatePath<T, U>;
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

	merge<U>(other: ResolvablePath<T, U>): Path<T, U> {
		return new PathImpl<T, U>(
			mergeSegments(this.segments, resolveSegments(other)),
		) as unknown as Path<T, U>;
	}

	subtract<U>(prefix: ResolvablePath<T, U>): Path<U, V> | null {
		const a = this.segments;
		const b = resolveSegments(prefix);
		if (b.length > a.length) return null;
		if (!segmentsEqual(a.slice(0, b.length), b)) return null;
		return new PathImpl<U, V>(a.slice(b.length)) as unknown as Path<U, V>;
	}

	slice(start?: number, end?: number): Path<T, unknown> {
		return new PathImpl<T, unknown>(
			this.segments.slice(start, end),
		) as unknown as Path<T, unknown>;
	}

	to<U>(relative: ResolvablePath<V, U>): Path<T, U> {
		const tail = resolveSegments(relative);
		return new PathImpl<T, U>([...this.segments, ...tail]) as unknown as Path<
			T,
			U
		>;
	}
}

// ---------------------------------------------------------------------------
// TemplatePathImpl — path containing * or ** wildcards
// ---------------------------------------------------------------------------

export class TemplatePathImpl<T = unknown, V = unknown> extends PathImpl<T, V> {
	override each<U = CollectionItem<V>>(
		expr?: (item: CollectionItem<V>) => U,
	): TemplatePath<T, U> {
		const tail = expr ? evalExpr(expr as (p: unknown) => unknown) : [];
		return new TemplatePathImpl<T, U>([
			...this.segments,
			WILDCARD,
			...tail,
		]) as unknown as TemplatePath<T, U>;
	}

	override deep<U = V>(expr?: (leaf: V) => U): TemplatePath<T, U> {
		const tail = expr ? evalExpr(expr as (p: unknown) => unknown) : [];
		return new TemplatePathImpl<T, U>([
			...this.segments,
			DEEP_WILDCARD,
			...tail,
		]) as unknown as TemplatePath<T, U>;
	}

	// Return type is Path<T,U> to satisfy class covariance (PathImpl.to returns Path<T,U>).
	// At runtime the value IS a TemplatePathImpl; callers see TemplatePath<T,U> via the
	// re-declaration in TemplatePath type (types.ts).
	override to<U>(relative: ResolvablePath<V, U>): Path<T, U> {
		const tail = resolveSegments(relative);
		return new TemplatePathImpl<T, U>([
			...this.segments,
			...tail,
		]) as unknown as Path<T, U>;
	}

	override merge<U>(other: ResolvablePath<T, U>): Path<T, U> {
		return new TemplatePathImpl<T, U>(
			mergeSegments(this.segments, resolveSegments(other)),
		) as unknown as Path<T, U>;
	}

	/**
	 * Resolves this template to all concrete paths that exist in `data`.
	 */
	expand(data: T): Path<T, V>[] {
		const results: Path<T, V>[] = [];

		const walk = (current: unknown, idx: number, acc: Segment[]): void => {
			if (idx >= this.segments.length) {
				results.push(new PathImpl<T, V>(acc));
				return;
			}
			const seg = this.segments[idx];

			if (seg === WILDCARD) {
				if (current != null && typeof current === "object") {
					const keys = Array.isArray(current)
						? (Array.from(current.keys()) as number[])
						: Object.keys(current);
					for (const key of keys) {
						walk((current as Record<string | number, unknown>)[key], idx + 1, [
							...acc,
							key,
						]);
					}
				}
			} else if (seg === DEEP_WILDCARD) {
				// Try matching rest of pattern at current depth
				walk(current, idx + 1, acc);
				// Recurse into every child
				if (current != null && typeof current === "object") {
					const keys = Array.isArray(current)
						? (Array.from(current.keys()) as number[])
						: Object.keys(current);
					for (const key of keys) {
						walk((current as Record<string | number, unknown>)[key], idx, [
							...acc,
							key,
						]);
					}
				}
			} else {
				if (
					current != null &&
					typeof current === "object" &&
					seg in (current as object)
				) {
					walk((current as Record<string | number, unknown>)[seg], idx + 1, [
						...acc,
						seg,
					]);
				}
			}
		};

		walk(data, 0, []);
		return results;
	}

	// @ts-expect-error: TemplatePath.get returns V[] not V|undefined
	override get(data: T): V[] {
		return this.expand(data).map((p) => p.get(data) as V);
	}

	override set(data: T, value: V): T {
		const paths = this.expand(data);
		let current = data;
		for (const p of paths) {
			current = p.set(current, value);
		}
		return current;
	}

	/**
	 * Applies `updater` to each matched value individually (per-item transform).
	 * Use `.set(data, constant)` to assign the same value to every match.
	 */
	override update(data: T, updater: (current: V | undefined) => V): T {
		const paths = this.expand(data);
		let current = data;
		for (const p of paths) {
			current = p.set(current, updater(p.get(current)));
		}
		return current;
	}
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function evalExpr(expr: (proxy: unknown) => unknown): readonly Segment[] {
	const proxy = createPathProxy([]);
	const result = expr(proxy);
	return (
		((result as Record<symbol, unknown>)?.[PATH_SEGMENTS] as Segment[]) ?? []
	);
}

function mergeSegments(
	a: readonly Segment[],
	b: readonly Segment[],
): readonly Segment[] {
	let overlapLen = 0;
	for (let len = Math.min(a.length, b.length); len >= 1; len--) {
		if (segmentsEqual(a.slice(-len), b.slice(0, len))) {
			overlapLen = len;
			break;
		}
	}
	return overlapLen > 0 ? [...a.slice(0, -overlapLen), ...b] : [...a, ...b];
}
