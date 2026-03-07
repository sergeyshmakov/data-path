import { describe, expect, it } from "vitest";
import { path, unsafePath } from "../index.js";

interface User {
	items: Array<{ name: string }>;
	address: { city: string };
}

describe("path()", () => {
	describe("creation", () => {
		it("serializes to string and exposes segments array", () => {
			const p = path((x: User) => x.address.city);
			expect(p.segments).toEqual(["address", "city"]);
			expect(p.$).toBe("address.city");
			expect(p.length).toBe(2);
		});

		it("records dynamic indices via array access", () => {
			const i = 3;
			const p = path((x: User) => x.items[i].name);
			expect(p.segments).toEqual(["items", 3, "name"]);
			expect(p.$).toBe("items.3.name");
		});

		it("records function call results evaluated once", () => {
			const getIndex = () => 2;
			const p = path((x: User) => x.items[getIndex()].name);
			expect(p.segments).toEqual(["items", 2, "name"]);
		});

		it("silently ignores side-accessed properties", () => {
			const p = path((x: User) => {
				void x.address;
				return x.items;
			});
			expect(p.segments).toEqual(["items"]);
		});

		it("conditional branching inside lambdas silently records only the truthy branch", () => {
			// biome-ignore lint/style/noNonNullAssertion: intentional - falsy branch is ignored by path extraction, assertion satisfies type checker
			const p = path((x: { a: { b: string; c: string } | null }) =>
				x.a ? x.a.b : x.a!.c,
			);
			expect(p.segments).toEqual(["a", "b"]);
		});
	});

	describe("composition", () => {
		it("composition concatenates base and tail segments", () => {
			const base = path((x: User) => x.items);
			const full = path(base, (p) => p[0].name);
			expect(full.segments).toEqual(["items", 0, "name"]);
			expect(full.$).toBe("items.0.name");
		});

		it("composition of unsafe paths concatenates their segments", () => {
			const a = unsafePath<User>("address.street");
			const b = unsafePath<User>("city");
			// @ts-expect-error - Testing runtime concatenation of two Path objects as specified in edge-cases
			const composed = path(a, b);
			expect(composed.segments).toEqual(["address", "street", "city"]);
			expect(composed.$).toBe("address.street.city");
		});

		it("immutability: path composition does not mutate the base path object", () => {
			const base = path((x: User) => x.items);
			const _full = path(base, (p) => p[0].name);
			expect(base.segments).toEqual(["items"]);
		});
	});

	describe("unexpected cases", () => {
		it("safely yields empty path when lambda returns literal", () => {
			const p = path((_x: User) => "hello");
			expect(p.segments).toEqual([]);
		});

		it("safely yields empty path when lambda returns null or undefined", () => {
			const p1 = path((_x: User) => null);
			expect(p1.segments).toEqual([]);
			const p2 = path((_x: User) => undefined);
			expect(p2.segments).toEqual([]);
		});

		it("yields empty path for side effects only", () => {
			const p = path((_x: User) => {
				const _a = 1 + 1;
			});
			expect(p.segments).toEqual([]);
		});
	});

	describe(".fn accessor", () => {
		it("returns a function that extracts the value", () => {
			const p = path((x: User) => x.address.city);
			const users: User[] = [
				{ items: [], address: { city: "New York" } },
				{ items: [], address: { city: "London" } },
			];
			const cities = users.map(p.fn);
			expect(cities).toEqual(["New York", "London"]);
		});
	});

	describe("typing incorrect cases", () => {
		it("rejects passing primitives when base path is expected", () => {
			expect(() => {
				// @ts-expect-error
				path("string base", (x: any) => x.something);
			}).toThrow();
		});

		it("rejects passing objects that are not paths", () => {
			expect(() => {
				// @ts-expect-error
				path({ notA: "path" }, (x: any) => x.something);
			}).toThrow();
		});
	});
});
