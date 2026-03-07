/**
 * Runtime tests for .merge(), .subtract(), .slice().
 * @see spec/idea.md §6, spec/edge-cases.md
 */

import { describe, expect, it } from "vitest";
import { path } from "../index.js";

interface Store {
	products: Array<{ list: { activities: Array<{ name: string }> } }>;
}

describe("Path algebra", () => {
	describe(".merge()", () => {
		it("accepts lambda expressions", () => {
			const i = 0;
			const root = path((p: Store) => p.products[i].list);
			const merged = root.merge((p) => p.products[i].list.activities[0].name);
			expect(merged.$).toBe("products.0.list.activities.0.name");
		});

		it("uses longest suffix-prefix overlap", () => {
			const i = 0;
			const t = 0;
			const root = path((p: Store) => p.products[i].list);
			const tail = path<{ list: { activities: Array<{ name: string }> } }>(
				(p) => p.list.activities[t].name,
			);
			const merged = root.merge(tail);
			expect(merged.$).toBe("products.0.list.activities.0.name");
		});

		it("concatenates when no overlap", () => {
			const i = 0;
			const t = 0;
			const a = path((p: Store) => p.products[i]);
			const b = path<{ activities: Array<{ name: string }> }>(
				(p) => p.activities[t].name,
			);
			const merged = a.merge(b);
			expect(merged.$).toBe("products.0.activities.0.name");
		});

		it("identical paths returns same path", () => {
			const a = path((p: { user: { name: string } }) => p.user.name);
			const b = path((p: { user: { name: string } }) => p.user.name);
			const merged = a.merge(b);
			expect(merged.$).toBe("user.name");
		});

		it("with ambiguous overlaps uses longest match", () => {
			const a = path(
				(p: { list: { items: { list: string } } }) => p.list.items.list,
			);
			const b = path((p: { list: { count: number } }) => p.list.count);
			const merged = a.merge(b);
			expect(merged.segments).toEqual(["list", "items", "list", "count"]);
		});

		it("correctly handles overlaps with numeric runtime indices", () => {
			const i = 3;
			const root = path<{ products: Array<{ list: string }> }>(
				(p) => p.products[i].list,
			);
			const tail = path<{ list: { items: Array<{ name: string }> } }>(
				(p) => p.list.items[0].name,
			);
			const merged = root.merge(tail);
			expect(merged.segments).toEqual([
				"products",
				3,
				"list",
				"items",
				0,
				"name",
			]);
		});

		it("with a prefix returns the longer path unchanged", () => {
			const a = path(
				(p: { user: { address: { city: string } } }) => p.user.address,
			);
			const b = path(
				(p: { user: { address: { city: string } } }) => p.user.address.city,
			);
			const merged = a.merge(b);
			expect(merged.segments).toEqual(["user", "address", "city"]);
		});

		it("immutability: returns new instance without mutating original", () => {
			const original = path((p: { a: { b: { c: string } } }) => p.a.b.c);
			const mergeTail = path((p: { c: { d: string } }) => p.c.d);
			const merged = original.merge(mergeTail);
			expect(merged).not.toBe(original);
			expect(original.segments).toEqual(["a", "b", "c"]);
		});
	});

	describe(".subtract()", () => {
		it("accepts lambda expressions", () => {
			const full = path((p: Store) => p.products[0].list.activities[0].name);
			const result = full.subtract((p) => p.products[0].list);
			expect(result).not.toBeNull();
			expect(result?.$).toBe("activities.0.name");
		});

		it("prefix returns suffix", () => {
			const i = 0;
			const t = 0;
			const full = path((p: Store) => p.products[i].list.activities[t].name);
			const root = path((p: Store) => p.products[i].list);
			const result = full.subtract(root);
			expect(result).not.toBeNull();
			expect(result?.$).toBe("activities.0.name");
		});

		it("suffix returns prefix", () => {
			const i = 0;
			const t = 0;
			const full = path((p: Store) => p.products[i].list.activities[t].name);
			const tail = path<{ activities: Array<{ name: string }> }>(
				(p) => p.activities[t].name,
			);
			const result = full.subtract(tail);
			expect(result).not.toBeNull();
			expect(result?.$).toBe("products.0.list");
		});

		it("unrelated path returns null", () => {
			const full = path((p: { a: { b: { c: { d: string } } } }) => p.a.b.c.d);
			const x = path((p: { b: { c: string } }) => p.b.c);
			const result = full.subtract(x);
			expect(result).toBeNull();
		});

		it("self returns empty path", () => {
			const p = path((x: { a: { b: { c: string } } }) => x.a.b.c);
			const result = p.subtract(p);
			expect(result).not.toBeNull();
			expect(result?.length).toBe(0);
			expect(result?.$).toBe("");
		});

		it("a longer path from a shorter path returns null", () => {
			const short = path((p: { a: { b: string } }) => p.a.b);
			const long = path((p: { a: { b: { c: { d: string } } } }) => p.a.b.c.d);
			expect(short.subtract(long)).toBeNull();
		});

		it("immutability: returns new instance without mutating original", () => {
			const original = path((p: { a: { b: { c: string } } }) => p.a.b.c);
			const subtracted = original.subtract(path((p: { c: string }) => p.c));
			expect(subtracted).not.toBe(original);
			expect(original.segments).toEqual(["a", "b", "c"]);
		});
	});

	describe(".slice()", () => {
		it("follows Array.slice semantics", () => {
			const p = path<{
				products: Array<{ list: { activities: Array<{ name: string }> } }>;
			}>((x) => x.products[0].list.activities[2].name);
			expect(p.slice(0, 3).$).toBe("products.0.list");
			expect(p.slice(3).$).toBe("activities.2.name");
			expect(p.slice(-1).$).toBe("name");
		});

		it("silently clamps out-of-bounds indices", () => {
			const p = path((x: { a: { b: { c: string } } }) => x.a.b.c);
			expect(p.slice(0, 10).segments).toEqual(["a", "b", "c"]);
			expect(p.slice(-10).segments).toEqual(["a", "b", "c"]);
		});

		it("produces an empty path when the range is empty", () => {
			const p = path((x: { a: { b: { c: string } } }) => x.a.b.c);
			expect(p.slice(2, 2).segments).toEqual([]);
			expect(p.slice(2, 2).length).toBe(0);
		});

		it("immutability: returns new instance without mutating original", () => {
			const original = path((p: { a: { b: { c: string } } }) => p.a.b.c);
			const sliced = original.slice(0, 2);
			expect(sliced).not.toBe(original);
			expect(original.segments).toEqual(["a", "b", "c"]);
		});
	});

	describe("not matchable cases", () => {
		it(".subtract() with completely unrelated path returns null", () => {
			const a = path((p: { a: number }) => p.a);
			const b = path((p: { b: number }) => p.b);
			expect(a.subtract(b as any)).toBeNull();
		});

		it(".subtract() where subtracted path is longer than original returns null", () => {
			const a = path((p: { a: { b: number } }) => p.a);
			const b = path((p: { a: { b: number } }) => p.a.b);
			expect(a.subtract(b)).toBeNull();
		});
	});

	describe("unexpected cases", () => {
		it(".slice() using NaN, Infinity, or negative infinity", () => {
			const p = path((x: { a: { b: { c: string } } }) => x.a.b.c);
			expect(() => p.slice(NaN, NaN)).not.toThrow();
			expect(() => p.slice(Infinity, Infinity)).not.toThrow();
			expect(() => p.slice(-Infinity, Infinity)).not.toThrow();
		});
	});

	describe("typing incorrect cases", () => {
		it("allows .merge() with completely incompatible base at compile time due to structural typing", () => {
			const head = path((p: { a: number }) => p.a);
			const tail = path((p: { b: string }) => p.b);

			// No ts-expect-error because BasePath structurally matches { segments: Segment[] }
			head.merge(tail);
		});
	});
});
