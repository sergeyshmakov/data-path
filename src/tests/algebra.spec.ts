/**
 * Runtime tests for .merge(), .subtract(), .slice().
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
		it("accepts a lambda prefix expression", () => {
			const full = path((p: Store) => p.products[0].list.activities[0].name);
			const result = full.subtract((p) => p.products[0].list);
			expect(result).not.toBeNull();
			expect(result?.$).toBe("activities.0.name");
		});

		it("prefix path returns the remaining suffix", () => {
			const i = 0;
			const t = 0;
			const full = path((p: Store) => p.products[i].list.activities[t].name);
			const prefix = path((p: Store) => p.products[i].list);
			const result = full.subtract(prefix);
			expect(result).not.toBeNull();
			expect(result?.$).toBe("activities.0.name");
		});

		it("subtracting the full path returns an empty path", () => {
			const p = path((x: { a: { b: { c: string } } }) => x.a.b.c);
			const result = p.subtract(p);
			expect(result).not.toBeNull();
			expect(result?.length).toBe(0);
			expect(result?.$).toBe("");
		});

		it("unrelated path returns null", () => {
			const full = path((p: { a: { b: { c: { d: string } } } }) => p.a.b.c.d);
			const x = path((p: { b: { c: string } }) => p.b.c);
			const result = full.subtract(x as any);
			expect(result).toBeNull();
		});

		it("longer prefix than path returns null", () => {
			const short = path((p: { a: { b: string } }) => p.a.b);
			const long = path((p: { a: { b: { c: { d: string } } } }) => p.a.b.c.d);
			expect(short.subtract(long)).toBeNull();
		});

		it("empty prefix returns the full path", () => {
			const p = path((x: { a: { b: string } }) => x.a.b);
			const root = path<{ a: { b: string } }>();
			const result = p.subtract(root);
			expect(result).not.toBeNull();
			expect(result?.segments).toEqual(["a", "b"]);
		});

		it("non-matching prefix (shared root, diverging) returns null", () => {
			const a = path((p: { a: number }) => p.a);
			const b = path((p: { b: number }) => p.b);
			expect(a.subtract(b as any)).toBeNull();
		});

		it("immutability: returns new instance without mutating original", () => {
			const original = path((p: { a: { b: { c: string } } }) => p.a.b.c);
			const prefix = path((p: { a: { b: { c: string } } }) => p.a);
			const subtracted = original.subtract(prefix);
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

	describe("unexpected cases", () => {
		it(".slice() using NaN, Infinity, or negative infinity", () => {
			const p = path((x: { a: { b: { c: string } } }) => x.a.b.c);
			expect(() => p.slice(NaN, NaN)).not.toThrow();
			expect(() => p.slice(Infinity, Infinity)).not.toThrow();
			expect(() => p.slice(-Infinity, Infinity)).not.toThrow();
		});
	});

	describe("TemplatePath.merge()", () => {
		it("returns a TemplatePath that preserves wildcard expansion", () => {
			interface Data {
				users: Array<{ profile: { name: string } }>;
			}
			const tmpl = path((p: Data) => p.users).each((u) => u.profile);
			// segments: ["users", "*", "profile"]
			const tail = path((p: { profile: { name: string } }) => p.profile.name);
			// segments: ["profile", "name"] — overlap "profile" collapses once
			const merged = tmpl.merge(tail);
			expect(merged.segments).toEqual(["users", "*", "profile", "name"]);
			expect(merged.$).toBe("users.*.profile.name");
			const data: Data = {
				users: [{ profile: { name: "Alice" } }, { profile: { name: "Bob" } }],
			};
			expect(merged.get(data)).toEqual(["Alice", "Bob"]);
		});

		it("concatenates when there is no overlap", () => {
			interface Data {
				items: Array<{ value: number }>;
			}
			const tmpl = path((p: Data) => p.items).each();
			// segments: ["items", "*"]
			const tail = path((p: { value: number }) => p.value);
			// segments: ["value"] — no overlap with "*"
			const merged = tmpl.merge(tail);
			expect(merged.segments).toEqual(["items", "*", "value"]);
			const data: Data = { items: [{ value: 1 }, { value: 2 }] };
			expect(merged.get(data)).toEqual([1, 2]);
		});
	});

	describe("typing incorrect cases", () => {
		it("allows .merge() with incompatible base at compile time due to structural typing", () => {
			const head = path((p: { a: number }) => p.a);
			const tail = path((p: { b: string }) => p.b);
			// No ts-expect-error: BasePath structurally matches { segments: Segment[] }
			head.merge(tail);
		});
	});
});
