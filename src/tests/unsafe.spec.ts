/**
 * Runtime tests for unsafePath().
 * @see spec/idea.md §2, spec/edge-cases.md §8
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
