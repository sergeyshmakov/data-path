import { PATH_SEGMENTS } from "../constants.js";
import type {
	BasePath,
	CollectionItem,
	Path,
	ResolvablePath,
	Segment,
	TemplatePath,
	TraversablePathMethods,
} from "../types.js";
import { createPathProxy, resolveSegments, segmentsEqual } from "../utils.js";
import { AbstractPathImpl, DEEP_WILDCARD, WILDCARD } from "./base-path-impl.js";

// ---------------------------------------------------------------------------
// PathImpl — concrete path with no wildcards
// ---------------------------------------------------------------------------

export class PathImpl<T = unknown, V = unknown>
	extends AbstractPathImpl<T, V>
	implements BasePath<T, V>, TraversablePathMethods<T, V>
{
	readonly fn: (data: T) => V | undefined;

	constructor(segments: readonly Segment[]) {
		super(segments);
		this.fn = (data: T) => this.get(data);
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
		return makeConcrete<T, unknown>(
			this.segments.slice(0, -1),
		) as unknown as Path<T, unknown>;
	}

	subtract<U>(prefix: ResolvablePath<T, U>): Path<U, V> | null {
		const a = this.segments;
		const b = resolveSegments(prefix);
		if (b.length > a.length) return null;
		if (!segmentsEqual(a.slice(0, b.length), b)) return null;
		return makeConcrete<U, V>(a.slice(b.length)) as unknown as Path<U, V>;
	}

	slice(start?: number, end?: number): Path<T, unknown> {
		return makeConcrete<T, unknown>(
			this.segments.slice(start, end),
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

	to<U>(relative: ResolvablePath<V, U>): Path<T, U> | TemplatePath<T, U> {
		const tail = resolveSegments(relative);
		const combined = [...this.segments, ...tail];
		if (relative instanceof TemplatePathImpl) {
			return new TemplatePathImpl<T, U>(combined) as unknown as TemplatePath<
				T,
				U
			>;
		}
		return new PathImpl<T, U>(combined) as unknown as Path<T, U>;
	}

	merge<U>(other: ResolvablePath<T, U>): Path<T, U> | TemplatePath<T, U> {
		const merged = mergeSegments(this.segments, resolveSegments(other));
		if (other instanceof TemplatePathImpl) {
			return new TemplatePathImpl<T, U>(merged) as unknown as TemplatePath<
				T,
				U
			>;
		}
		return new PathImpl<T, U>(merged) as unknown as Path<T, U>;
	}
}

/**
 * Returns a concrete `PathImpl` when `segments` contains no wildcards,
 * otherwise a `TemplatePathImpl` so `.get()` correctly expands matches.
 *
 * Only safe to call on segment lists that originate from a template path
 * (e.g. `TemplatePathImpl.parent/slice/subtract`). For composition from
 * concrete sources, template-ness must be derived from the argument's
 * identity (`instanceof TemplatePathImpl`), not from segment content —
 * otherwise legitimate object keys named `"*"` or `"**"` get reinterpreted
 * as wildcards.
 */
function makeFromSegments<T, V>(
	segments: readonly Segment[],
): PathImpl<T, V> | TemplatePathImpl<T, V> {
	return hasWildcard(segments)
		? new TemplatePathImpl<T, V>(segments)
		: new PathImpl<T, V>(segments);
}

function hasWildcard(segments: readonly Segment[]): boolean {
	for (const s of segments) {
		if (s === WILDCARD || s === DEEP_WILDCARD) return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// TemplatePathImpl — path containing * or ** wildcards
// ---------------------------------------------------------------------------

export class TemplatePathImpl<
	T = unknown,
	V = unknown,
> extends AbstractPathImpl<T, V> {
	// fn returns V[] (not V|undefined) — no covariance conflict since we don't
	// extend PathImpl; the declared type here matches TemplatePath<T,V>.fn.
	readonly fn: (data: T) => V[];

	constructor(segments: readonly Segment[]) {
		super(segments);
		this.fn = (data: T) => this.get(data);
	}

	get(data: T): V[] {
		return this.expand(data).map(
			// expand() only returns paths where the key exists in data, so get() is safe
			(p) => p.get(data) as V,
		);
	}

	set(data: T, value: V): T {
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
	update(data: T, updater: (current: V | undefined) => V): T {
		const paths = this.expand(data);
		let current = data;
		for (const p of paths) {
			current = p.set(current, updater(p.get(current)));
		}
		return current;
	}

	parent(): Path<T, unknown> | TemplatePath<T, unknown> | null {
		if (this.segments.length === 0) return null;
		return makeFromSegments<T, unknown>(
			this.segments.slice(0, -1),
		) as unknown as Path<T, unknown> | TemplatePath<T, unknown>;
	}

	subtract<U>(
		prefix: ResolvablePath<T, U>,
	): Path<U, V> | TemplatePath<U, V> | null {
		const a = this.segments;
		const b = resolveSegments(prefix);
		if (b.length > a.length) return null;
		if (!segmentsEqual(a.slice(0, b.length), b)) return null;
		return makeFromSegments<U, V>(a.slice(b.length)) as unknown as
			| Path<U, V>
			| TemplatePath<U, V>;
	}

	slice(
		start?: number,
		end?: number,
	): Path<T, unknown> | TemplatePath<T, unknown> {
		return makeFromSegments<T, unknown>(
			this.segments.slice(start, end),
		) as unknown as Path<T, unknown> | TemplatePath<T, unknown>;
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

	to<U>(relative: ResolvablePath<V, U>): TemplatePath<T, U> {
		const tail = resolveSegments(relative);
		return new TemplatePathImpl<T, U>([
			...this.segments,
			...tail,
		]) as unknown as TemplatePath<T, U>;
	}

	merge<U>(other: ResolvablePath<T, U>): TemplatePath<T, U> {
		return new TemplatePathImpl<T, U>(
			mergeSegments(this.segments, resolveSegments(other)),
		) as unknown as TemplatePath<T, U>;
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
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function makeConcrete<T, V>(segments: readonly Segment[]): PathImpl<T, V> {
	return new PathImpl<T, V>(segments);
}

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
