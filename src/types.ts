/**
 * Core type definitions for data-path.
 * @see spec/idea.md
 */

/** A path segment: string key or numeric index */
export type Segment = string | number;

/** Relation returned by .match() */
export type MatchRelation =
	| "includes"
	| "included-by"
	| "equals"
	| "parent"
	| "child"
	| null;

/** Result of .match() — bidirectional relationship + optional params */
export interface MatchResult {
	relation: MatchRelation;
	params?: Record<string, string>;
}

/** Resolved type at the end of a path (leaf value type) */
export type ResolvedType<_T, _P extends string> = unknown; // Simplified for stubs; full impl uses recursive keyof

/** Deep-reachable types for .deep() leaf parameter (enables IDE autocomplete) */
export type DeepReachable<T> = T;

/**
 * Extracts the item type from a collection (Array or Record) so that traversal methods
 * (like `.each()`) know what type of item they are iterating over.
 *
 * @template V The collection type (e.g., `string[]` or `Record<string, number>`)
 */
export type CollectionItem<V> =
	V extends ReadonlyArray<infer U>
		? U
		: V extends Record<PropertyKey, infer U>
			? U
			: unknown;

/** Primitives that cannot have traversal methods called on them */
export type Primitive =
	| string
	| number
	| boolean
	| symbol
	| bigint
	| null
	| undefined;

/** Expression type for path construction — receives proxy, returns any (path is inferred from access) */
export type PathExpression<T, R = unknown> = (proxy: T) => R;

/**
 * Represents the various forms a path can take when provided as an input argument.
 * This enables API flexibility, allowing methods (like `merge`, `match`, `startsWith`)
 * to accept an existing path object, a raw segments object, or a lambda expression.
 *
 * @template T The root data type.
 * @template V The resolved value type at the end of the path.
 */
export type ResolvablePath<T, V = unknown> =
	| BasePath<T, V, string>
	| { segments: readonly Segment[] }
	| PathExpression<T, V>;

/**
 * Extracted methods for traversing into collections or deep structures.
 * This is separated from `BasePath` so that these methods can be conditionally
 * excluded from the type system when a path points to a primitive value
 * (since primitives cannot be traversed).
 */
export interface TraversablePathMethods<T, V> {
	/**
	 * Traverses into a collection (Array or Record) to operate on each item.
	 *
	 * @example
	 * const users = path<Root>().users;
	 * const userNames = users.each(u => u.name); // Path matches all names
	 */
	each<U = CollectionItem<V>>(
		expr?: (item: CollectionItem<V>) => U,
	): TemplatePath<T, U, string>;

	/**
	 * Traverses deeply into a structure, matching any nested property.
	 *
	 * @example
	 * const root = path<Root>();
	 * const allIds = root.deep(node => node.id); // Path matches any 'id' at any depth
	 */
	deep<U = DeepReachable<V>>(
		expr?: (leaf: DeepReachable<V>) => U,
	): TemplatePath<T, U, string>;
}

/**
 * The foundational structure for all path objects (both standard and template paths).
 * Contains common properties and operations including value extraction/mutation,
 * relational algebra (comparisons), and structural manipulation.
 *
 * @template T Root data type the path operates on.
 * @template V The expected value type that the path resolves to.
 * @template _P The string representation of the path (optional/unused in runtime, but useful for type-level strings).
 */
export interface BasePath<
	T = unknown,
	V = unknown,
	_P extends string = string,
> {
	/**
	 * The array of segments (string keys or numeric indices) that make up this path.
	 */
	readonly segments: readonly Segment[];

	/**
	 * The number of segments in this path.
	 */
	readonly length: number;

	/**
	 * The string representation of the path (e.g. "users.0.name").
	 * Useful for binding paths to form libraries or UI components.
	 *
	 * @example
	 * path<Root>().users[0].name.$; // "users.0.name"
	 */
	readonly $: _P;

	/**
	 * Returns the string representation of the path (e.g. "users.0.name").
	 *
	 * @example
	 * path<Root>().users[0].name.toString(); // "users.0.name"
	 */
	toString(): string;

	/**
	 * Extracts the value at this path from the given data object.
	 * Safely handles missing intermediate properties by returning `undefined` instead of throwing an error.
	 *
	 * @example
	 * const namePath = path<User>().name;
	 * const name = namePath.get({ name: "Alice" }); // "Alice"
	 */
	get(data: T): V;

	/**
	 * Returns an accessor function that extracts the value at this path from the given data object.
	 * Useful for array methods like `.map()` or `.filter()`.
	 *
	 * @example
	 * const names = users.map(path<User>().name.fn);
	 */
	readonly fn: (data: T) => V;

	/**
	 * Sets the value at this path in the given data object, returning a new updated object (immutable).
	 * If intermediate properties are missing, they are automatically created as objects or arrays
	 * depending on the segment types (numeric keys become arrays).
	 *
	 * @example
	 * const namePath = path<User>().name;
	 * const updatedUser = namePath.set({ name: "Alice" }, "Bob"); // { name: "Bob" }
	 */
	set(data: T, value: V): T;

	/**
	 * Checks if this path starts with the segments of another path.
	 *
	 * @example
	 * const a = path<Root>().users[0].name;
	 * const b = path<Root>().users;
	 * a.startsWith(b); // true
	 */
	startsWith(other: ResolvablePath<T>): boolean;

	/**
	 * Checks if this path encompasses the segments of another path (i.e., this path is a prefix of the other).
	 *
	 * @example
	 * const a = path<Root>().users;
	 * const b = path<Root>().users[0].name;
	 * a.includes(b); // true
	 */
	includes(other: ResolvablePath<T>): boolean;

	/**
	 * Checks if this path is exactly equal to another path.
	 *
	 * @example
	 * const a = path<Root>().users;
	 * const b = path<Root>().users;
	 * a.equals(b); // true
	 */
	equals(other: ResolvablePath<T>): boolean;

	/**
	 * Matches this path against another path, returning their relationship.
	 *
	 * @example
	 * const a = path<Root>().users[0];
	 * const b = path<Root>().users;
	 * a.match(b); // { relation: 'child', params: {} }
	 */
	match(other: ResolvablePath<T>): MatchResult | null;

	/**
	 * Appends another path to the end of this path. If the end of this path matches
	 * the beginning of the other path, the overlapping segments are intelligently deduplicated.
	 *
	 * @example
	 * const base = path<Root>().users;
	 * const full = base.merge(p => p[0].name); // equivalent to path<Root>().users[0].name
	 */
	merge<U>(other: ResolvablePath<T, U>): Path<T, U, string>;

	/**
	 * Removes the segments of another path from either the beginning or the end of this path.
	 * Returns `null` if the other path is neither a prefix nor a suffix.
	 *
	 * @example
	 * const full = path<Root>().users[0].name;
	 * const base = path<Root>().users;
	 * const remainder = full.subtract(base); // equivalent to path()[0].name
	 */
	subtract(other: ResolvablePath<T>): Path<T, V, string> | null;

	/**
	 * Returns a new path containing a subset of the segments, similar to Array.prototype.slice.
	 *
	 * @example
	 * const full = path<Root>().users[0].name;
	 * full.slice(0, 1); // equivalent to path<Root>().users
	 */
	slice(start?: number, end?: number): Path<T, unknown, string>;

	/**
	 * Extends the current path using a lambda expression starting from the resolved value.
	 *
	 * @example
	 * const userPath = path<Root>().users[0];
	 * const namePath = userPath.to(u => u.name);
	 */
	to<U>(expr: PathExpression<V, U>): Path<T, U, string>;
}

/**
 * Represents a strongly-typed object property path.
 *
 * This type uses intersection (`&`) to combine the base operations (`BasePath`)
 * with conditional traversal methods (`TraversablePathMethods`). The conditional
 * check `[V] extends [Primitive]` ensures that IDEs will not suggest `.each()` or
 * `.deep()` when the path has resolved to a primitive value (like a string or number).
 *
 * @template T Root data type
 * @template V Resolved value type at path end
 * @template P Path string (e.g. "a.b.c") — literal when inferrable, string when dynamic
 */
export type Path<
	T = unknown,
	V = unknown,
	P extends string = string,
> = BasePath<T, V, P> &
	([V] extends [Primitive] ? {} : TraversablePathMethods<T, V>);

/**
 * Represents a path containing wildcards (`*` or `**`), useful for operations on multiple items.
 *
 * It extends the standard `Path` concept but alters the return types of `.each()` and `.deep()`
 * to return another `TemplatePath` (chaining templates). It also adds the `.expand()` method
 * which can resolve this template against actual data to return an array of concrete `Path`s.
 *
 * **Data Access:** Calling `.get()` on a `TemplatePath` will return an array of all matched values.
 * Calling `.set()` will immutably update all matched paths in the object and return the updated object.
 *
 * @template T Root data type
 * @template V Resolved value type at path end
 * @template P Path string (e.g. "a.*.c")
 */
export type TemplatePath<
	T = unknown,
	V = unknown,
	P extends string = string,
> = (Omit<BasePath<T, V, P>, "get" | "fn"> & {
	/**
	 * Extracts an array of values at this template path from the given data object.
	 *
	 * @example
	 * const names = path<Root>().users.each().name.get(data); // string[]
	 */
	get(data: T): V[];

	/**
	 * Returns an accessor function that extracts an array of values at this template path from the given data object.
	 * Useful for array methods like `.map()` or `.filter()`.
	 *
	 * @example
	 * const allNames = companies.map(path<Company>().departments.each().name.fn);
	 */
	readonly fn: (data: T) => V[];
}) &
	([V] extends [Primitive]
		? {}
		: {
				/**
				 * Traverses into a collection (Array or Record) to operate on each item, returning a TemplatePath.
				 *
				 * @example
				 * const users = path<Root>().users;
				 * const userNames = users.each(u => u.name); // TemplatePath matching all names
				 */
				each<U = CollectionItem<V>>(
					expr?: (item: CollectionItem<V>) => U,
				): TemplatePath<T, U, `${string}.${"*"}.${string}`>;

				/**
				 * Traverses deeply into a structure, matching any nested property, returning a TemplatePath.
				 *
				 * @example
				 * const root = path<Root>();
				 * const allIds = root.deep(node => node.id); // TemplatePath matching any 'id' at any depth
				 */
				deep<U = DeepReachable<V>>(
					expr?: (leaf: DeepReachable<V>) => U,
				): TemplatePath<T, U, `${string}.${"**"}.${string}`>;
			}) & {
		/**
		 * Resolves this template path against actual data to return an array of concrete paths
		 * that exist in the given data.
		 *
		 * Note: Currently, `expand` only supports evaluating a single wildcard (`*` or `**`) per path.
		 *
		 * @example
		 * const template = path<Root>().users.each().name;
		 * const concretePaths = template.expand(data); // [path<Root>().users[0].name, ...]
		 */
		expand(data: T): Path<T, V, string>[];
	};

/**
 * Constructor overloads for creating paths.
 *
 * This allows the `path()` function to be called in several ways:
 * 1. Without arguments: returns a root path `path<T>()`.
 * 2. With a lambda: returns a path built from the expression `path<T>((p) => p.a.b)`.
 * 3. With a base path and a lambda: allows extending an existing path `path(base, (p) => p.c)`.
 */
export type PathConstructor = {
	<T>(): Path<T, T, "">;
	<T, V = unknown>(expr: PathExpression<T, V>): Path<T, V, string>;
	<T, U, V = unknown>(
		base: BasePath<T, U, string>,
		expr: PathExpression<U, V>,
	): Path<T, V, string>;
};

/** Unsafe path from string — no type checking on segments */
export type UnsafePathConstructor = <T>(
	raw: string,
) => Path<T, unknown, string>;
