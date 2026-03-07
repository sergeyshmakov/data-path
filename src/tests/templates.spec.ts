/**
 * Runtime tests for .each(), .deep(), .expand().
 * @see spec/idea.md §4
 */

import { describe, expect, it } from "vitest";
import { path } from "../index.js";

interface User {
	items: Array<{ name: string }>;
	name: string;
}

interface Tree {
	tree: { label: string; children?: Tree["tree"][] };
}

describe("Template paths", () => {
	describe(".each()", () => {
		it("outputs single-level wildcard (*) with no arguments", () => {
			const tmpl = path((p: User) => p.items).each();
			expect(tmpl.$).toBe("items.*");
			expect(tmpl.segments).toEqual(["items", "*"]);
		});

		it("outputs single-level wildcard (*)", () => {
			const tmpl = path((p: User) => p.items).each(
				(i: { name: string }) => i.name,
			);
			expect(tmpl.$).toBe("items.*.name");
			expect(tmpl.segments).toEqual(["items", "*", "name"]);
		});

		it("path.each().to(p => p.x) produces same path string as path.each(p => p.x)", () => {
			const viaTo = path((p: User) => p.items).each().to((i) => i.name);
			const viaEach = path((p: User) => p.items).each((i) => i.name);
			expect(viaTo.$).toBe("items.*.name");
			expect(viaTo.segments).toEqual(["items", "*", "name"]);
			expect(viaTo.$).toBe(viaEach.$);
			expect(viaTo.segments).toEqual(viaEach.segments);
		});

		it("immutability: does not mutate original path", () => {
			const base = path((p: User) => p.items);
			base.each((i: { name: string }) => i.name);
			expect(base.segments).toEqual(["items"]);
		});
	});

	describe(".deep()", () => {
		it("outputs multi-level wildcard (**) with no arguments", () => {
			const deep = path((p: Tree) => p.tree).deep();
			expect(deep.$).toBe("tree.**");
			expect(deep.segments).toEqual(["tree", "**"]);
		});

		it("outputs multi-level wildcard (**)", () => {
			const deep = path((p: Tree) => p.tree).deep(
				(n: { label: string }) => n.label,
			);
			expect(deep.$).toBe("tree.**.label");
			expect(deep.segments).toEqual(["tree", "**", "label"]);
		});

		it("immutability: does not mutate original path", () => {
			const base = path((p: Tree) => p.tree);
			base.deep((n: { label: string }) => n.label);
			expect(base.segments).toEqual(["tree"]);
		});
	});

	describe(".expand()", () => {
		it("returns array of concrete paths", () => {
			const tmpl = path((p: User) => p.items).each(
				(i: { name: string }) => i.name,
			);
			const data: User = {
				items: [{ name: "A" }, { name: "B" }],
				name: "root",
			};
			const paths = tmpl.expand(data);
			expect(paths).toHaveLength(2);
			expect(paths[0].$).toBe("items.0.name");
			expect(paths[1].$).toBe("items.1.name");
		});

		it("on empty array returns []", () => {
			const tmpl = path((p: User) => p.items).each(
				(i: { name: string }) => i.name,
			);
			const data: User = { items: [], name: "root" };
			expect(tmpl.expand(data)).toEqual([]);
		});

		it("immutability: does not mutate original template path", () => {
			const tmpl = path((p: User) => p.items).each(
				(i: { name: string }) => i.name,
			);
			const data: User = {
				items: [{ name: "A" }, { name: "B" }],
				name: "root",
			};
			tmpl.expand(data);
			expect(tmpl.segments).toEqual(["items", "*", "name"]);
		});

		it("handles multiple wildcards (*)", () => {
			interface AppData {
				items: Array<{ settings: Array<{ value: number }> }>;
			}
			const tmpl = path((p: AppData) => p.items)
				.each((i) => i.settings)
				.each((s) => s.value);
			const data: AppData = {
				items: [
					{ settings: [{ value: 1 }, { value: 2 }] },
					{ settings: [{ value: 3 }] },
				],
			};
			const paths = tmpl.expand(data);
			expect(paths).toHaveLength(3);
			expect(paths[0].$).toBe("items.0.settings.0.value");
			expect(paths[1].$).toBe("items.0.settings.1.value");
			expect(paths[2].$).toBe("items.1.settings.0.value");
		});

		it("handles mixed wildcards (* and **)", () => {
			interface MixedData {
				items: Array<{ tree: { label: string; children?: any[] } }>;
			}
			const tmpl = path((p: MixedData) => p.items)
				.each((i) => i.tree)
				.deep((n) => n.label);
			const data: MixedData = {
				items: [
					{ tree: { label: "root1", children: [{ label: "child1" }] } },
					{ tree: { label: "root2" } },
				],
			};
			const paths = tmpl.expand(data);
			expect(paths).toHaveLength(3);
			expect(paths[0].$).toBe("items.0.tree.label");
			expect(paths[1].$).toBe("items.0.tree.children.0.label");
			expect(paths[2].$).toBe("items.1.tree.label");
		});
	});

	describe("unexpected / not matchable cases", () => {
		it(".expand() gracefully returns empty array for null/undefined/primitive data", () => {
			const tmpl = path((p: User) => p.items).each();
			expect(tmpl.expand(null as unknown as User)).toEqual([]);
			expect(tmpl.expand(undefined as unknown as User)).toEqual([]);
			expect(tmpl.expand("string" as unknown as User)).toEqual([]);
			expect(tmpl.expand(123 as unknown as User)).toEqual([]);
		});

		it(".expand() gracefully returns empty array when array/tree property doesn't exist", () => {
			const tmpl = path((p: User) => p.items).each();
			expect(tmpl.expand({ name: "no-items" } as User)).toEqual([]);
		});
	});

	describe(".fn accessor", () => {
		it("returns a function that extracts an array of values", () => {
			const tmpl = path((p: User) => p.items).each((i) => i.name);
			const users: User[] = [
				{ items: [{ name: "A" }, { name: "B" }], name: "root1" },
				{ items: [{ name: "C" }], name: "root2" },
				{ items: [], name: "root3" },
			];
			const allItems = users.map(tmpl.fn);
			expect(allItems).toEqual([["A", "B"], ["C"], []]);
		});
	});

	describe("typing incorrect cases", () => {
		it("rejects .each() and .deep() on primitive values", () => {
			const p = path((x: { name: string }) => x.name);
			// @ts-expect-error
			p.each();
			// @ts-expect-error
			p.deep();
		});
	});

	describe("bulk data access", () => {
		it(".get() returns array of all collected values", () => {
			const tmpl = path((p: User) => p.items).each((i) => i.name);
			const data: User = {
				items: [{ name: "A" }, { name: "B" }],
				name: "root",
			};
			const values = tmpl.get(data);
			expect(values).toEqual(["A", "B"]);
		});

		it(".set() immutably updates all matching paths", () => {
			const tmpl = path((p: User) => p.items).each((i) => i.name);
			const data: User = {
				items: [{ name: "A" }, { name: "B" }],
				name: "root",
			};
			const updated = tmpl.set(data, "Updated");
			expect(updated).not.toBe(data);
			expect(updated.items[0]).not.toBe(data.items[0]);
			expect(updated.items[0].name).toBe("Updated");
			expect(updated.items[1].name).toBe("Updated");
			expect(updated.name).toBe("root");
			// Original data unchanged
			expect(data.items[0].name).toBe("A");
		});
	});
});
