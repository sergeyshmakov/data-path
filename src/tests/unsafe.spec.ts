/**
 * Runtime tests for unsafePath().
 */

import { describe, expect, it } from "vitest";
import { unsafePath } from "../index.js";

describe("unsafePath()", () => {
	describe("creation", () => {
		it("parses normal string paths", () => {
			const p = unsafePath<{ address: { city: string } }>("address.city");
			expect(p.segments).toEqual(["address", "city"]);
			expect(p.$).toBe("address.city");
		});

		it("handles empty string as empty path", () => {
			const p = unsafePath<object>("");
			expect(p.segments).toEqual([]);
			expect(p.length).toBe(0);
			expect(p.$).toBe("");
		});

		it("handles numeric segments", () => {
			const p = unsafePath<{ items: string[] }>("items.0");
			expect(p.segments).toEqual(["items", 0]);
		});

		it("preserves numeric-looking object keys as strings", () => {
			const p = unsafePath<object>("data.01");
			expect(p.segments).toEqual(["data", "01"]);
			const p2 = unsafePath<object>("a.1e3.b");
			expect(p2.segments).toEqual(["a", "1e3", "b"]);
		});

		it("handles malformed strings with best-effort parse", () => {
			const p = unsafePath<object>("a..b");
			expect(p.segments).toContain("");
		});

		it("handles leading dots with an empty segment", () => {
			const p = unsafePath<{ name: string }>(".name");
			expect(p.segments).toEqual(["", "name"]);
		});

		it("immutability: does not mutate when calling methods like toString()", () => {
			const p = unsafePath<{ address: { city: string } }>("address.city");
			p.$;
			expect(p.segments).toEqual(["address", "city"]);
		});
	});

	describe("value generic V", () => {
		it("unsafePath<T, V> narrows get() return to V | undefined", () => {
			const p = unsafePath<{ name: string }, string>("name");
			const data = { name: "Alice" };
			// At runtime, get() returns the value
			expect(p.get(data)).toBe("Alice");
		});

		it("unsafePath<T, V>.fn returns (T) => V | undefined", () => {
			const p = unsafePath<{ count: number }, number>("count");
			const items = [{ count: 1 }, { count: 2 }, { count: 3 }];
			expect(items.map(p.fn)).toEqual([1, 2, 3]);
		});

		it("unsafePath without V defaults to unknown leaf type", () => {
			const p = unsafePath<{ name: string }>("name");
			// get() still works at runtime even though type is V|undefined = unknown|undefined
			expect(p.get({ name: "Alice" })).toBe("Alice");
		});
	});

	describe("unexpected cases", () => {
		it("handles extremely malformed strings", () => {
			const p1 = unsafePath<object>("...");
			expect(p1.segments).toEqual(["", "", "", ""]);

			const p2 = unsafePath<object>("a.foo bar.b");
			expect(p2.segments).toEqual(["a", "foo bar", "b"]);

			const p3 = unsafePath<object>("a.b.");
			expect(p3.segments).toEqual(["a", "b", ""]);

			const p4 = unsafePath<object>("!@#.$%^");
			expect(p4.segments).toEqual(["!@#", "$%^"]);
		});
	});

	describe("typing incorrect cases", () => {
		it("rejects non-string arguments at compile time", () => {
			expect(() => {
				// @ts-expect-error
				unsafePath(123);
			}).toThrow();

			expect(() => {
				// @ts-expect-error
				unsafePath({ path: "a.b" });
			}).toThrow();
		});
	});
});
