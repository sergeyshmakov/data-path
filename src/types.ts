/**
 * Core type definitions for data-path.
 */

/** A path segment: string key or numeric index */
export type Segment = string | number;

/**
 * The structural relation returned by `.match()`.
 *
 * Semantics when calling `a.match(b)`:
 * - `"parent"`    — `a` is a prefix of `b`   (a is the parent, b is deeper)
 * - `"child"`     — `b` is a prefix of `a`   (b is the parent, a is deeper)
 * - `"equals"`    — `a` and `b` are identical
 * - `"includes"`  — `a` (with wildcards) covers `b` as a concrete match
 * - `"included-by"` — `b` (with wildcards) covers `a` as a concrete match
 */
export type MatchRelation =
	| "includes"
	| "included-by"
	| "equals"
	| "parent"
	| "child";

/** Result of .match() — relation only; params are reserved for named-wildcard support */
export interface MatchResult {
	relation: MatchRelation;
}

/**
 * Extracts the resolved value type from a path object.
 *
 * @example
 * const agePath = path<User>(p => p.profile.age);
 * type Age = ResolvedType<typeof agePath>; // number
 */
export type ResolvedType<P> = P extends { get(data: any): (infer V)[] }
	? V // TemplatePath: get() returns V[]
	: P extends BasePath<any, infer V>
		? V // Path: get() returns V|undefined
		: never;

/**
 * Extracts the item type from a collection (Array or Record).
 * Used by `.each()` to infer the traversal target.
 */
export type CollectionItem<V> =
	V extends ReadonlyArray<infer U>
		? U
		: V extends Record<PropertyKey, infer U>
			? U
			: unknown;

/** Primitive types that cannot be traversed — `.each()` and `.deep()` are hidden when V extends Primitive */
export type Primitive =
	| string
	| number
	| boolean
	| symbol
	| bigint
	| null
	| undefined;

/** Lambda used to build a path — receives a proxy typed as T, infers the path from property access */
export type PathExpression<T, R = unknown> = (proxy: T) => R;

/**
 * Flexible path argument — accepts an existing path, a `{segments}` shape, or a lambda expression.
 * Used by all methods that accept a path as an argument.
 */
export type ResolvablePath<T, V = unknown> =
	| BasePath<T, V>
	| { segments: readonly Segment[] }
	| PathExpression<T, V>;

/**
 * Traversal methods — only present when V is not a primitive type.
 * Conditionally excluded by the Path and TemplatePath types.
 */
export interface TraversablePathMethods<T, V> {
	/**
	 * Traverses into a collection (Array or Record), inserting a `*` wildcard.
	 * Returns a TemplatePath that matches every item.
	 *
	 * @example
	 * path<Root>().users.each(u => u.name)  // TemplatePath — all names
	 * path<Root>().users.each()              // TemplatePath — all items
	 */
	each<U = CollectionItem<V>>(
		expr?: (item: CollectionItem<V>) => U,
	): TemplatePath<T, U>;

	/**
	 * Traverses deeply into a structure, inserting a `**` wildcard.
	 * Returns a TemplatePath that matches the given property at any nesting depth.
	 *
	 * @example
	 * path<Root>().tree.deep(node => node.id)  // TemplatePath — any nested 'id'
	 * path<Root>().tree.deep()                 // TemplatePath — every descendant node
	 */
	deep<U = V>(expr?: (leaf: V) => U): TemplatePath<T, U>;
}

/**
 * The foundational interface shared by both Path and TemplatePath.
 *
 * @template T  Root data type the path operates on
 * @template V  Resolved value type at the end of the path
 */
export interface BasePath<T = unknown, V = unknown> {
	/** Ordered array of string keys and numeric indices that compose this path. */
	readonly segments: readonly Segment[];

	/** Number of segments in this path. */
	readonly length: number;

	/**
	 * Dot-notation string representation (e.g. `"users.0.name"`).
	 * Convenient for binding paths to form libraries.
	 *
	 * @example
	 * path<Root>(r => r.users[0].name).$  // "users.0.name"
	 */
	readonly $: string;

	/** Returns the dot-notation string representation. */
	toString(): string;

	/**
	 * Extracts the value at this path from a data object.
	 * Returns `undefined` — rather than throwing — when any intermediate segment is missing.
	 *
	 * @example
	 * path<User>(u => u.profile.name).get(user)  // string | undefined
	 */
	get(data: T): V | undefined;

	/**
	 * Pre-bound accessor function. Useful for array higher-order methods.
	 *
	 * @example
	 * users.map(path<User>(u => u.name).fn)  // string | undefined[]
	 */
	readonly fn: (data: T) => V | undefined;

	/**
	 * Immutably sets the value at this path, returning a structurally-cloned object.
	 * Missing intermediates are created automatically:
	 * numeric next-segment → array, string next-segment → object.
	 *
	 * @example
	 * path<User>(u => u.name).set(user, "Alice")
	 */
	set(data: T, value: V): T;

	/**
	 * Reads the current value, passes it to `updater`, and writes the result back immutably.
	 * Combines `.get()` + `.set()` in a single expression.
	 * On a `TemplatePath`, `updater` is called once per expanded match (per-item transform).
	 *
	 * @example
	 * namePath.update(user, name => (name ?? "").toUpperCase())
	 */
	update(data: T, updater: (current: V | undefined) => V): T;

	/**
	 * Returns the parent path (all segments except the last), or `null` for a root/empty path.
	 * Value type becomes `unknown` — use a typed path expression if the parent type is needed.
	 *
	 * @example
	 * path<User>(u => u.profile.name).parent()?.$ // "profile"
	 * path<User>().parent()                        // null
	 */
	parent(): Path<T, unknown> | null;

	/**
	 * Returns `true` if this path's segments begin with all segments of `other`
	 * (i.e. `other` is a prefix of `this`). Supports wildcard segments.
	 */
	startsWith(other: ResolvablePath<T>): boolean;

	/**
	 * Returns `true` if `other`'s segments begin with all segments of this path
	 * (i.e. this path is a prefix of `other`). Supports wildcard segments.
	 */
	includes(other: ResolvablePath<T>): boolean;

	/** Returns `true` if this path is segment-by-segment identical to `other`. */
	equals(other: ResolvablePath<T>): boolean;

	/**
	 * Returns the structural relationship between this path and `other`, or `null` when unrelated.
	 *
	 * `"parent"` means **this** path is the parent (shorter prefix); `"child"` means **this** is deeper.
	 *
	 * @example
	 * profilePath.match(namePath)  // { relation: "parent" }  — profilePath IS the parent
	 * namePath.match(profilePath)  // { relation: "child" }   — namePath is deeper
	 */
	match(other: ResolvablePath<T>): MatchResult | null;

	/**
	 * Appends `other` (a T-rooted path) with smart suffix/prefix overlap deduplication.
	 * When the tail of this path matches the head of `other`, the overlap is collapsed once.
	 *
	 * @example
	 * const base = path<Root>(r => r.users[0].profile);
	 * base.merge(r => r.users[0].profile.name)  // "users.0.profile.name" (no duplication)
	 */
	merge<U>(other: ResolvablePath<T, U>): Path<T, U>;

	/**
	 * Removes `prefix` from the start of this path and returns the remaining tail.
	 * Returns `null` when `prefix` is not a leading segment-sequence of this path.
	 *
	 * The returned path carries the correct root type (`U` — the type `prefix` resolves to),
	 * so it can be passed directly to `.to()` or used independently.
	 *
	 * @example
	 * const full   = path<Company>(c => c.departments[0].employees[0].name);
	 * const prefix = path<Company>(c => c.departments[0]);
	 * full.subtract(prefix)  // Path<Department, string>
	 */
	subtract<U>(prefix: ResolvablePath<T, U>): Path<U, V> | null;

	/**
	 * Returns a new path over a slice of segments, following `Array.prototype.slice` semantics.
	 * Value type becomes `unknown` because the type at an arbitrary segment boundary is not statically inferable.
	 *
	 * @example
	 * path<Root>(r => r.users[0].name).slice(0, 2).$  // "users.0"
	 */
	slice(start?: number, end?: number): Path<T, unknown>;

	/**
	 * Extends this path with a relative path rooted at `V`.
	 * Accepts a lambda expression, a pre-built `Path<V, U>`, or any `{segments}` object.
	 *
	 * @example
	 * // Lambda form:
	 * employeePath.to(e => e.profile.firstName)
	 *
	 * // Pre-built path form (no extra lambda needed):
	 * const firstName = path<Employee>(e => e.profile.firstName);
	 * employeePath.to(firstName)
	 */
	to<U>(relative: ResolvablePath<V, U>): Path<T, U>;
}

/**
 * A strongly-typed object property path.
 * `.each()` and `.deep()` are only present when `V` is not a primitive type.
 *
 * @template T  Root data type
 * @template V  Resolved value type at the end of the path
 */
export type Path<T = unknown, V = unknown> = BasePath<T, V> &
	([V] extends [Primitive] ? {} : TraversablePathMethods<T, V>);

/**
 * A path that contains wildcards (`*` or `**`), matching multiple values at once.
 *
 * - `.get(data)` returns an array of all matched values.
 * - `.set(data, value)` immutably sets every match to the same constant.
 * - `.update(data, fn)` applies a per-item transform to every match.
 * - `.expand(data)` resolves the template to an array of concrete `Path` objects.
 *
 * @template T  Root data type
 * @template V  Item value type at the end of the template path
 */
export type TemplatePath<T = unknown, V = unknown> = Omit<
	BasePath<T, V>,
	"get" | "fn" | "to" | "merge" | "subtract"
> & {
	/**
	 * Returns an array of all values matched by this template.
	 *
	 * @example
	 * path<Root>().users.each(u => u.name).get(data)  // string[]
	 */
	get(data: T): V[];

	/**
	 * Pre-bound accessor function returning an array of all matched values.
	 *
	 * @example
	 * companies.map(path<Company>().departments.each(d => d.name).fn)
	 */
	readonly fn: (data: T) => V[];

	/**
	 * Resolves this template to an array of concrete paths that exist in `data`.
	 *
	 * @example
	 * path<Root>().users.each().name.expand(data)
	 * // [path<Root>().users[0].name, path<Root>().users[1].name, ...]
	 */
	expand(data: T): Path<T, V>[];

	/**
	 * Extends this template with a relative path rooted at `V`, preserving wildcard expansion.
	 * Returns a `TemplatePath` so the full chain (including the appended segments) is template-aware.
	 *
	 * @example
	 * path<Root>(r => r.users).each().to(u => u.name)
	 * // TemplatePath — collects every user's name
	 */
	to<U>(relative: ResolvablePath<V, U>): TemplatePath<T, U>;

	/**
	 * Appends `other` with smart overlap deduplication, preserving wildcard behavior.
	 * Returns a `TemplatePath` because `this` carries wildcards.
	 */
	merge<U>(other: ResolvablePath<T, U>): TemplatePath<T, U>;
} & ([V] extends [Primitive]
		? {}
		: {
				each<U = CollectionItem<V>>(
					expr?: (item: CollectionItem<V>) => U,
				): TemplatePath<T, U>;
				deep<U = V>(expr?: (leaf: V) => U): TemplatePath<T, U>;
			});

/**
 * The overloaded call signature of the `path()` function.
 */
export type PathConstructor = {
	<T>(): Path<T, T>;
	<T, V = unknown>(expr: PathExpression<T, V>): Path<T, V>;
	<T, U, V = unknown>(
		base: BasePath<T, U>,
		expr: PathExpression<U, V>,
	): Path<T, V>;
};

/** Call signature of the `unsafePath()` function */
export type UnsafePathConstructor = <T, V = unknown>(raw: string) => Path<T, V>;
