import type { MatchResult, Path, Segment, TemplatePath, BasePath, TraversablePathMethods, ResolvablePath, PathExpression, CollectionItem, DeepReachable } from "../types.js";
import { WILDCARD, DEEP_WILDCARD, PATH_SEGMENTS } from "../constants.js";
import {
    createPathProxy,
    segmentsEqual,
    matchesPrefix,
    patternMatches,
    resolveSegments,
} from "../utils.js";

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
let TemplatePathCtor: Function;
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function setTemplatePathCtor(ctor: Function) {
    TemplatePathCtor = ctor;
}

export class PathImpl<
    T = unknown,
    V = unknown,
    P extends string = string,
> implements BasePath<T, V, P>, TraversablePathMethods<T, V> {
    readonly segments: readonly Segment[];

    constructor(segments: readonly Segment[]) {
        this.segments = segments;
    }

    /**
     * The number of segments in this path.
     */
    get length(): number {
        return this.segments.length;
    }

    /**
     * The string representation of the path (e.g. "users.0.name").
     * Useful for binding paths to form libraries or UI components.
     * 
     * @example
     * path<Root>().users[0].name.$; // "users.0.name"
     */
    get $(): P {
        return this.toString() as P;
    }

    /**
     * Returns the string representation of the path (e.g. "users.0.name").
     * 
     * @example
     * path<Root>().users[0].name.toString(); // "users.0.name"
     */
    toString(): string {
        return this.segments.join(".");
    }

    /**
     * Extracts the value at this path from the given data object.
     * Safely handles missing intermediate properties by returning `undefined` instead of throwing an error.
     * 
     * @example
     * const namePath = path<User>().name;
     * const name = namePath.get({ name: "Alice" }); // "Alice"
     */
    get(data: T): V {
        let current: unknown = data;
        for (const seg of this.segments) {
            if (current == null) return undefined as V;
            current = (current as Record<string | number, unknown>)[seg];
        }
        return current as V;
    }

    /**
     * Returns an accessor function that extracts the value at this path from the given data object.
     * Useful for array methods like `.map()` or `.filter()`.
     * 
     * @example
     * const names = users.map(path<User>().name.fn);
     */
    get fn(): (data: T) => V {
        return (data: T) => this.get(data);
    }

    /**
     * Sets the value at this path in the given data object, returning a new updated object (immutable).
     * If intermediate properties are missing, they are automatically created as objects or arrays 
     * depending on the segment types (numeric keys become arrays).
     * 
     * @example
     * const namePath = path<User>().name;
     * const updatedUser = namePath.set({ name: "Alice" }, "Bob"); // { name: "Bob" }
     */
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

    /**
     * Traverses into a collection (Array or Record) to operate on each item.
     * 
     * @example
     * const users = path<Root>().users;
     * const userNames = users.each(u => u.name); // Path matches all names
     */
    each<U = CollectionItem<V>>(expr?: (item: CollectionItem<V>) => U): TemplatePath<T, U, string> {
        let tailSegments: readonly Segment[] = [];
        if (expr) {
            const proxy = createPathProxy([]);
            const result = expr(proxy as CollectionItem<V>);
            tailSegments = (result as Record<symbol, unknown>)?.[PATH_SEGMENTS] as Segment[] ?? [];
        }
        return new (TemplatePathCtor as new (segments: readonly Segment[]) => unknown)([
            ...this.segments,
            WILDCARD,
            ...tailSegments,
        ]) as unknown as TemplatePath<T, U, string>;
    }

    /**
     * Traverses deeply into a structure, matching any nested property.
     * 
     * @example
     * const root = path<Root>();
     * const allIds = root.deep(node => node.id); // Path matches any 'id' at any depth
     */
    deep<U = DeepReachable<V>>(expr?: (leaf: DeepReachable<V>) => U): TemplatePath<T, U, string> {
        let tailSegments: readonly Segment[] = [];
        if (expr) {
            const proxy = createPathProxy([]);
            const result = expr(proxy as DeepReachable<V>);
            tailSegments = (result as Record<symbol, unknown>)?.[PATH_SEGMENTS] as Segment[] ?? [];
        }
        return new (TemplatePathCtor as new (segments: readonly Segment[]) => unknown)([
            ...this.segments,
            DEEP_WILDCARD,
            ...tailSegments,
        ]) as unknown as TemplatePath<T, U, string>;
    }

    /**
     * Checks if this path starts with the segments of another path.
     * 
     * @example
     * const a = path<Root>().users[0].name;
     * const b = path<Root>().users;
     * a.startsWith(b); // true
     */
    startsWith(other: ResolvablePath<T>): boolean {
        return matchesPrefix(this.segments, resolveSegments(other));
    }

    /**
     * Checks if this path encompasses the segments of another path (i.e., this path is a prefix of the other).
     * 
     * @example
     * const a = path<Root>().users;
     * const b = path<Root>().users[0].name;
     * a.includes(b); // true
     */
    includes(other: ResolvablePath<T>): boolean {
        return matchesPrefix(resolveSegments(other), this.segments);
    }

    /**
     * Checks if this path is exactly equal to another path.
     * 
     * @example
     * const a = path<Root>().users;
     * const b = path<Root>().users;
     * a.equals(b); // true
     */
    equals(other: ResolvablePath<T>): boolean {
        return segmentsEqual(this.segments, resolveSegments(other));
    }

    /**
     * Matches this path against another path, returning their relationship.
     * 
     * @example
     * const a = path<Root>().users[0];
     * const b = path<Root>().users;
     * a.match(b); // { relation: 'child', params: {} }
     */
    match(other: ResolvablePath<T>): MatchResult | null {
        const otherSegs = resolveSegments(other);
        if (segmentsEqual(this.segments, otherSegs)) {
            return { relation: "equals", params: {} };
        }
        if (
            matchesPrefix(this.segments, otherSegs) &&
            this.segments.length > otherSegs.length
        ) {
            return { relation: "child", params: {} };
        }
        if (
            matchesPrefix(otherSegs, this.segments) &&
            otherSegs.length > this.segments.length
        ) {
            return { relation: "parent", params: {} };
        }
        if (patternMatches(this.segments, otherSegs)) {
            return { relation: "includes", params: {} };
        }
        if (patternMatches(otherSegs, this.segments)) {
            return { relation: "included-by", params: {} };
        }
        return null;
    }

    /**
     * Appends another path to the end of this path. If the end of this path matches 
     * the beginning of the other path, the overlapping segments are intelligently deduplicated.
     * 
     * @example
     * const base = path<Root>().users;
     * const full = base.merge(p => p[0].name); // equivalent to path<Root>().users[0].name
     */
    merge<U>(other: ResolvablePath<T, U>): Path<T, U, string> {
        const a = this.segments;
        const b = resolveSegments(other);
        let overlapLen = 0;
        for (let len = Math.min(a.length, b.length); len >= 1; len--) {
            const aSuffix = a.slice(-len);
            const bPrefix = b.slice(0, len);
            if (segmentsEqual(aSuffix, bPrefix)) {
                overlapLen = len;
                break;
            }
        }
        const merged =
            overlapLen > 0 ? [...a.slice(0, -overlapLen), ...b] : [...a, ...b];
        return new PathImpl<T, U, string>(merged);
    }

    /**
     * Removes the segments of another path from either the beginning or the end of this path.
     * Returns `null` if the other path is neither a prefix nor a suffix.
     * 
     * @example
     * const full = path<Root>().users[0].name;
     * const base = path<Root>().users;
     * const remainder = full.subtract(base); // equivalent to path()[0].name
     */
    subtract(other: ResolvablePath<T>): Path<T, V, string> | null {
        const a = this.segments;
        const b = resolveSegments(other);
        if (b.length > a.length) return null;
        if (segmentsEqual(a, b)) return new PathImpl<T, V, string>([]);
        // b prefix of a?
        if (segmentsEqual(a.slice(0, b.length), b)) {
            return new PathImpl<T, V, string>(a.slice(b.length));
        }
        // b suffix of a?
        if (segmentsEqual(a.slice(-b.length), b)) {
            return new PathImpl<T, V, string>(a.slice(0, -b.length));
        }
        return null;
    }

    /**
     * Returns a new path containing a subset of the segments, similar to Array.prototype.slice.
     * 
     * @example
     * const full = path<Root>().users[0].name;
     * full.slice(0, 1); // equivalent to path<Root>().users
     */
    slice(start?: number, end?: number): Path<T, unknown, string> {
        const s = this.segments.slice(start, end);
        return new PathImpl<T, unknown, string>(s);
    }

    /**
     * Extends the current path using a lambda expression starting from the resolved value.
     * 
     * @example
     * const userPath = path<Root>().users[0];
     * const namePath = userPath.to(u => u.name);
     */
    to<U>(expr: PathExpression<V, U>): Path<T, U, string> {
        const proxy = createPathProxy([]);
        const result = expr(proxy as V);
        const tailSegments = (result as Record<symbol, unknown>)?.[PATH_SEGMENTS] as Segment[] ?? [];
        return new PathImpl<T, U, string>([...this.segments, ...tailSegments]);
    }
}