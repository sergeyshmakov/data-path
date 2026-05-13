/**
 * Runtime tests for .startsWith(), .includes(), .equals(), .match().
 */

import { describe, expect, it } from "vitest";
import { path } from "../index.js";

interface R {
	items: Array<{ name: string }>;
}

describe("Path interactions", () => {
	describe(".startsWith()", () => {
		it("concrete.startsWith(prefix) returns true when under pattern", () => {
			const concrete = path((p: R) => p.items[0].name);
			const prefix = path((p: R) => p.items).each((i: { name: string }) => i);
			expect(concrete.startsWith(prefix)).toBe(true);
		});

		it("template.startsWith(concrete) returns false", () => {
			const concrete = path((p: R) => p.items[0].name);
			const template = path((p: R) => p.items).each(
				(i: { name: string }) => i.name,
			);
			expect(template.startsWith(concrete)).toBe(false);
		});

		it("immutability: does not mutate original path", () => {
			const concrete = path((p: R) => p.items[0].name);
			const prefix = path((p: R) => p.items).each((i: { name: string }) => i);
			concrete.startsWith(prefix);
			expect(concrete.segments).toEqual(["items", 0, "name"]);
		});
	});

	describe(".includes()", () => {
		it("template.includes(concrete) returns true when pattern covers path", () => {
			const concrete = path((p: R) => p.items[0].name);
			const template = path((p: R) => p.items).each(
				(i: { name: string }) => i.name,
			);
			expect(template.includes(concrete)).toBe(true);
		});

		it("concrete.includes(template) returns false", () => {
			const concrete = path((p: R) => p.items[0].name);
			const template = path((p: R) => p.items).each(
				(i: { name: string }) => i.name,
			);
			expect(concrete.includes(template)).toBe(false);
		});

		it("immutability: does not mutate original path", () => {
			const concrete = path((p: R) => p.items[0].name);
			const template = path((p: R) => p.items).each(
				(i: { name: string }) => i.name,
			);
			template.includes(concrete);
			expect(template.segments).toEqual(["items", "*", "name"]);
		});
	});

	describe(".equals()", () => {
		it("validates segment-by-segment identity", () => {
			const a = path((p: R) => p.items[0].name);
			const b = path((p: R) => p.items[0].name);
			const c = path((p: R) => p.items[1].name);
			expect(a.equals(b)).toBe(true);
			expect(a.equals(c)).toBe(false);
		});

		it("immutability: does not mutate original path", () => {
			const a = path((p: R) => p.items[0].name);
			const b = path((p: R) => p.items[0].name);
			a.equals(b);
			expect(a.segments).toEqual(["items", 0, "name"]);
		});
	});

	describe(".match()", () => {
		it("returns correct relation for template vs concrete", () => {
			const concrete = path((p: R) => p.items[0].name);
			const template = path((p: R) => p.items).each(
				(i: { name: string }) => i.name,
			);
			const result = template.match(concrete);
			expect(result).not.toBeNull();
			expect(result?.relation).toBe("includes");
		});

		it("result has no params property (removed until named wildcards land)", () => {
			const concrete = path((p: R) => p.items[0].name);
			const template = path((p: R) => p.items).each(
				(i: { name: string }) => i.name,
			);
			const result = template.match(concrete);
			expect(result).not.toBeNull();
			// params is not part of MatchResult
			expect("params" in (result ?? {})).toBe(false);
		});

		it("returns null when comparing two different templates", () => {
			const a = path((p: R) => p.items).each((i: { name: string }) => i.name);
			const b = path((p: { items: Array<{ price: number }> }) => p.items).each(
				(i) => i.price,
			);
			expect(a.match(b)).toBeNull();
		});

		it("parent / child relations", () => {
			const parent = path((p: R) => p.items);
			const child = path((p: R) => p.items[0].name);
			expect(parent.match(child)?.relation).toBe("parent");
			expect(child.match(parent)?.relation).toBe("child");
		});

		it("equals relation", () => {
			const a = path((p: R) => p.items[0].name);
			const b = path((p: R) => p.items[0].name);
			expect(a.match(b)?.relation).toBe("equals");
		});

		it("immutability: does not mutate original path", () => {
			const concrete = path((p: R) => p.items[0].name);
			const template = path((p: R) => p.items).each(
				(i: { name: string }) => i.name,
			);
			template.match(concrete);
			expect(template.segments).toEqual(["items", "*", "name"]);
		});
	});

	describe("not matchable cases", () => {
		it("returns false/null for completely disjoint paths", () => {
			const a = path((p: R) => p.items[0].name);
			const b = path((p: { other: string }) => p.other);

			expect(a.startsWith(b as any)).toBe(false);
			expect(a.includes(b as any)).toBe(false);
			expect(a.equals(b as any)).toBe(false);
			expect(a.match(b as any)).toBeNull();
		});
	});

	describe("unexpected cases", () => {
		it("handles null/undefined gracefully without throwing", () => {
			const a = path((p: R) => p.items);
			expect(() => a.startsWith(null as any)).not.toThrow();
			expect(() => a.includes(undefined as any)).not.toThrow();
			expect(() => a.equals({} as any)).not.toThrow();
			expect(() => a.match(123 as any)).not.toThrow();
		});
	});

	describe("typing incorrect cases", () => {
		it("allows comparisons with incompatible root types at compile time due to structural typing", () => {
			const a = path((p: R) => p.items);
			const b = path((p: { different: string }) => p.different);
			// No ts-expect-error: BasePath structurally matches { segments: Segment[] }
			a.match(b);
			a.merge(b);
		});
	});
});
