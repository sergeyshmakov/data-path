/**
 * Runtime tests for unsafePath().
 */

import { describe, expect, it } from "vitest";
import { path, unsafePath } from "../index.js";

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

	describe("wildcard segments", () => {
		it("'*' in the string is stored as the literal string \"*\", NOT the wildcard sentinel", () => {
			// Wildcards are unique Symbols; unsafePath only produces strings/numbers.
			// So `"*"` in a dotted string is always a literal segment.
			const p = unsafePath<object>("a.*.b");
			expect(p.segments).toEqual(["a", "*", "b"]);
		});

		it("unsafePath with '*' does literal key lookup via .get() — no template expansion", () => {
			type Data = { items: Record<string, { name: string }> };
			const p = unsafePath<Data, string>("items.*.name");
			const data: Data = {
				items: { "*": { name: "star" }, a: { name: "alpha" } },
			};
			expect(p.get(data)).toBe("star");
		});

		it("unsafePath '*' is NOT wildcard-matched by startsWith/covers (was a bug pre-sentinel)", () => {
			// Before the sentinel refactor, the SAME path behaved as literal for .get()
			// but as wildcard for relational methods — a split-personality bug.
			// After: relational methods compare on segment identity, so literal "*" only
			// matches another literal "*", not arbitrary keys.
			type Data = { items: Array<{ name: string }> };
			const literal = unsafePath<Data>("items.*.name");
			const concrete = path((p: Data) => p.items[0].name);
			expect(literal.covers(concrete)).toBe(false);
			expect(concrete.startsWith(literal)).toBe(false);

			// A real template (built via .each()) still matches:
			const template = path((p: Data) => p.items).each((i) => i.name);
			expect(template.covers(concrete)).toBe(true);
			expect(concrete.startsWith(template)).toBe(true);
		});

		it("unsafePath '*' segment renders as '*' in .$ for dot-notation compatibility", () => {
			const p = unsafePath<object>("a.*.b");
			expect(p.$).toBe("a.*.b");
			expect(p.toString()).toBe("a.*.b");
		});
	});
});
