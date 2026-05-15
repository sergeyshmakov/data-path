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

		it("conditional branching inside lambdas records only the truthy branch", () => {
			// biome-ignore lint/style/noNonNullAssertion: intentional
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

		it("composition with a pre-built path object uses .to()", () => {
			// path(base, expr) requires expr to be a lambda; to compose two path
			// objects use base.to(other) which accepts any ResolvablePath<V, U>.
			const a = unsafePath<User>("address");
			const b = unsafePath<{ city: string }>("city");
			const composed = a.to(b);
			expect(composed.segments).toEqual(["address", "city"]);
			expect(composed.$).toBe("address.city");
		});

		it("immutability: path composition does not mutate the base path object", () => {
			const base = path((x: User) => x.items);
			const _full = path(base, (p) => p[0].name);
			expect(base.segments).toEqual(["items"]);
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

		it("fn is stable — same reference across multiple accesses", () => {
			const p = path((x: User) => x.address.city);
			expect(p.fn).toBe(p.fn);
		});
	});

	describe(".update()", () => {
		it("reads, transforms, and writes immutably", () => {
			const p = path((x: { name: string }) => x.name);
			const data = { name: "alice" };
			const updated = p.update(data, (n) => (n ?? "").toUpperCase());
			expect(updated.name).toBe("ALICE");
			expect(data.name).toBe("alice"); // original unchanged
		});

		it("updater receives undefined when intermediate is missing", () => {
			const p = path<{ a?: { b: string } }>((x) => (x as any).a.b);
			const data: { a?: { b: string } } = {};
			const updated = p.update(data, (v) => v ?? "default");
			expect(updated).toEqual({ a: { b: "default" } });
		});

		it("immutability: returns a new object reference", () => {
			const p = path((x: { count: number }) => x.count);
			const data = { count: 1 };
			const updated = p.update(data, (n) => (n ?? 0) + 1);
			expect(updated).not.toBe(data);
			expect(updated.count).toBe(2);
		});
	});

	describe(".parent()", () => {
		it("returns path with last segment removed", () => {
			const p = path((x: User) => x.address.city);
			expect(p.parent()?.segments).toEqual(["address"]);
			expect(p.parent()?.$).toBe("address");
		});

		it("single-segment path returns empty root path", () => {
			const p = path((x: User) => x.address);
			const parent = p.parent();
			expect(parent).not.toBeNull();
			expect(parent?.length).toBe(0);
			expect(parent?.$).toBe("");
		});

		it("empty root path returns null", () => {
			const p = path<User>();
			expect(p.parent()).toBeNull();
		});

		it("immutability: does not mutate original path", () => {
			const p = path((x: User) => x.address.city);
			p.parent();
			expect(p.segments).toEqual(["address", "city"]);
		});
	});

	describe(".to() — lambda and path-object forms", () => {
		it("lambda form extends from resolved value type", () => {
			const base = path((x: User) => x.address);
			const full = base.to((a) => a.city);
			expect(full.$).toBe("address.city");
			expect(full.segments).toEqual(["address", "city"]);
		});

		it("path-object form accepts a pre-built Path<V, U>", () => {
			type Address = { city: string };
			const userPath = path((x: User) => x.address);
			const cityPath = path<Address>((a) => a.city);
			const full = userPath.to(cityPath);
			expect(full.$).toBe("address.city");
			expect(full.segments).toEqual(["address", "city"]);
		});

		it("{segments} object form concatenates raw segments", () => {
			const base = path((x: User) => x.address);
			const full = base.to({ segments: ["city"] });
			expect(full.$).toBe("address.city");
		});

		it("immutability: does not mutate original path", () => {
			const base = path((x: User) => x.address);
			const cityPath = path<{ city: string }>((a) => a.city);
			base.to(cityPath);
			expect(base.segments).toEqual(["address"]);
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
