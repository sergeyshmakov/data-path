import { DEEP_WILDCARD, PATH_SEGMENTS, WILDCARD } from "../constants.js";
import type {
	CollectionItem,
	DeepReachable,
	Path,
	Segment,
	TemplatePath,
} from "../types.js";
import { createPathProxy } from "../utils.js";
import { PathImpl } from "./path-impl.js";

export class TemplatePathImpl<
	T = unknown,
	V = unknown,
	P extends string = string,
> extends PathImpl<T, V, P> {
	/**
	 * Traverses into a collection (Array or Record) to operate on each item, returning a TemplatePath.
	 *
	 * @example
	 * const users = path<Root>().users;
	 * const userNames = users.each(u => u.name); // TemplatePath matching all names
	 */
	each<U = CollectionItem<V>>(
		expr?: (item: CollectionItem<V>) => U,
	): TemplatePath<T, U, `${string}.${"*"}.${string}`> {
		let tailSegments: readonly Segment[] = [];
		if (expr) {
			const proxy = createPathProxy([]);
			const result = expr(proxy as CollectionItem<V>);
			tailSegments =
				((result as Record<symbol, unknown>)?.[PATH_SEGMENTS] as Segment[]) ??
				[];
		}
		return new TemplatePathImpl([
			...this.segments,
			WILDCARD,
			...tailSegments,
		]) as unknown as TemplatePath<T, U, `${string}.${"*"}.${string}`>;
	}

	/**
	 * Traverses deeply into a structure, matching any nested property, returning a TemplatePath.
	 *
	 * @example
	 * const root = path<Root>();
	 * const allIds = root.deep(node => node.id); // TemplatePath matching any 'id' at any depth
	 */
	deep<U = DeepReachable<V>>(
		expr?: (leaf: DeepReachable<V>) => U,
	): TemplatePath<T, U, `${string}.${"**"}.${string}`> {
		let tailSegments: readonly Segment[] = [];
		if (expr) {
			const proxy = createPathProxy([]);
			const result = expr(proxy as DeepReachable<V>);
			tailSegments =
				((result as Record<symbol, unknown>)?.[PATH_SEGMENTS] as Segment[]) ??
				[];
		}
		return new TemplatePathImpl([
			...this.segments,
			DEEP_WILDCARD,
			...tailSegments,
		]) as unknown as TemplatePath<T, U, `${string}.${"**"}.${string}`>;
	}

	/**
	 * Resolves this template path against actual data to return an array of concrete paths
	 * that exist in the given data.
	 *
	 * @example
	 * const template = path<Root>().users.each().name;
	 * const concretePaths = template.expand(data); // [path<Root>().users[0].name, ...]
	 */
	expand(data: T): Path<T, V, string>[] {
		const results: Path<T, V, string>[] = [];

		const walk = (
			currentData: unknown,
			segmentIdx: number,
			currentPath: Segment[],
		) => {
			if (segmentIdx >= this.segments.length) {
				results.push(new PathImpl<T, V, string>(currentPath));
				return;
			}

			const seg = this.segments[segmentIdx];

			if (seg === WILDCARD) {
				if (currentData != null && typeof currentData === "object") {
					const keys = Array.isArray(currentData)
						? Array.from(currentData.keys())
						: Object.keys(currentData);
					for (const key of keys) {
						walk(
							(currentData as Record<string | number, unknown>)[key],
							segmentIdx + 1,
							[...currentPath, key],
						);
					}
				}
			} else if (seg === DEEP_WILDCARD) {
				// Match the rest of the path on the current node
				walk(currentData, segmentIdx + 1, currentPath);

				// Recursively explore all descendants
				if (currentData != null && typeof currentData === "object") {
					const keys = Array.isArray(currentData)
						? Array.from(currentData.keys())
						: Object.keys(currentData);
					for (const key of keys) {
						walk(
							(currentData as Record<string | number, unknown>)[key],
							segmentIdx,
							[...currentPath, key],
						);
					}
				}
			} else {
				if (
					currentData != null &&
					typeof currentData === "object" &&
					seg in currentData
				) {
					walk(
						(currentData as Record<string | number, unknown>)[seg],
						segmentIdx + 1,
						[...currentPath, seg],
					);
				}
			}
		};

		walk(data, 0, []);
		return results;
	}

	/**
	 * Extracts an array of values at this template path from the given data object.
	 *
	 * @example
	 * const names = path<Root>().users.each().name.get(data); // string[]
	 */
	// @ts-expect-error Overriding get to return an array instead of a single value
	get(data: T): V[] {
		return this.expand(data).map((p) => p.get(data));
	}

	/**
	 * Returns an accessor function that extracts an array of values at this template path from the given data object.
	 * Useful for array methods like `.map()` or `.filter()`.
	 *
	 * @example
	 * const allNames = companies.map(path<Company>().departments.each().name.fn);
	 */
	// @ts-expect-error Overriding fn to return an array instead of a single value
	get fn(): (data: T) => V[] {
		return (data: T) => this.get(data);
	}

	/**
	 * Sets the provided value to all matching paths immutably.
	 *
	 * @example
	 * const updatedData = path<Root>().users.each().name.set(data, "Bob");
	 */
	set(data: T, value: V): T {
		const paths = this.expand(data);
		let current = data;
		for (const p of paths) {
			current = p.set(current, value);
		}
		return current;
	}
}
