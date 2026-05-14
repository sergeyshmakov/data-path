/**
 * Runtime tests for .each(), .deep(), .expand(), template .update().
 */

import { describe, expect, it } from "vitest";
import { DEEP_WILDCARD, path, unsafePath, WILDCARD } from "../index.js";

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
			expect(tmpl.segments).toEqual(["items", WILDCARD]);
		});

		it("outputs single-level wildcard (*)", () => {
			const tmpl = path((p: User) => p.items).each(
				(i: { name: string }) => i.name,
			);
			expect(tmpl.$).toBe("items.*.name");
			expect(tmpl.segments).toEqual(["items", WILDCARD, "name"]);
		});

		it("path.each().to(lambda) produces same path as path.each(lambda)", () => {
			const viaTo = path((p: User) => p.items)
				.each()
				.to((i) => i.name);
			const viaEach = path((p: User) => p.items).each((i) => i.name);
			expect(viaTo.$).toBe("items.*.name");
			expect(viaTo.segments).toEqual(["items", WILDCARD, "name"]);
			expect(viaTo.$).toBe(viaEach.$);
			// .to() on a template must preserve wildcard expansion
			const data: User = {
				items: [{ name: "A" }, { name: "B" }],
				name: "root",
			};
			expect(viaTo.get(data)).toEqual(["A", "B"]);
		});

		it("path.each().to(path object) extends with a pre-built path", () => {
			type Item = { name: string };
			const itemsPath = path((p: User) => p.items).each();
			const namePath = path((i: Item) => i.name);
			const full = itemsPath.to(namePath);
			expect(full.$).toBe("items.*.name");
			// Template behavior preserved after .to(path object)
			const data: User = { items: [{ name: "X" }], name: "root" };
			expect(full.get(data)).toEqual(["X"]);
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
			expect(deep.segments).toEqual(["tree", DEEP_WILDCARD]);
		});

		it("outputs multi-level wildcard (**)", () => {
			const deep = path((p: Tree) => p.tree).deep(
				(n: { label: string }) => n.label,
			);
			expect(deep.$).toBe("tree.**.label");
			expect(deep.segments).toEqual(["tree", DEEP_WILDCARD, "label"]);
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
			expect(tmpl.segments).toEqual(["items", WILDCARD, "name"]);
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

		it(".set(data, constant) immutably updates all matching paths", () => {
			const tmpl = path((p: User) => p.items).each((i) => i.name);
			const data: User = {
				items: [{ name: "A" }, { name: "B" }],
				name: "root",
			};
			const updated = tmpl.set(data, "Updated");
			expect(updated).not.toBe(data);
			expect(updated.items[0].name).toBe("Updated");
			expect(updated.items[1].name).toBe("Updated");
			expect(updated.name).toBe("root");
			// Original data unchanged
			expect(data.items[0].name).toBe("A");
		});

		it(".update(data, fn) applies per-item transform to each match", () => {
			const tmpl = path((p: User) => p.items).each((i) => i.name);
			const data: User = {
				items: [{ name: "alice" }, { name: "bob" }],
				name: "root",
			};
			const updated = tmpl.update(data, (n) => (n ?? "").toUpperCase());
			expect(updated.items[0].name).toBe("ALICE");
			expect(updated.items[1].name).toBe("BOB");
			expect(updated.name).toBe("root");
			// Original data unchanged
			expect(data.items[0].name).toBe("alice");
		});

		it(".update() on empty template returns data unchanged", () => {
			const tmpl = path((p: User) => p.items).each((i) => i.name);
			const data: User = { items: [], name: "root" };
			const updated = tmpl.update(data, (n) => (n ?? "").toUpperCase());
			expect(updated).toEqual(data);
		});

		it(".update() only updates paths that exist in data (expand skips missing leaves)", () => {
			interface Sparse {
				records: Array<{ value?: number }>;
			}
			const tmpl = path((p: Sparse) => p.records).each((r) => r.value);
			const data: Sparse = {
				records: [{ value: 1 }, {}, { value: 3 }],
			};
			const updated = tmpl.update(data, (v) => (v ?? 0) * 10);
			expect(updated.records[0].value).toBe(10);
			// records[1] has no "value" key — expand() skips it, so update() doesn't touch it
			expect(updated.records[1].value).toBeUndefined();
			expect(updated.records[2].value).toBe(30);
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

		it("fn is stable — same reference across multiple accesses", () => {
			const tmpl = path((p: User) => p.items).each((i) => i.name);
			expect(tmpl.fn).toBe(tmpl.fn);
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

		it(".expand() gracefully returns empty array when array property doesn't exist", () => {
			const tmpl = path((p: User) => p.items).each();
			expect(tmpl.expand({ name: "no-items" } as User)).toEqual([]);
		});
	});

	describe(".parent() on a template path", () => {
		it("keeps wildcard segments — parent remains a TemplatePath whose .get() expands", () => {
			const tmpl = path((p: User) => p.items).each((i) => i.name);
			// segments: ["items", "*", "name"] → parent: ["items", "*"]
			const parent = tmpl.parent();
			expect(parent).not.toBeNull();
			expect(parent?.segments).toEqual(["items", WILDCARD]);
			expect(parent?.$).toBe("items.*");

			// The critical bug being guarded against: parent must expand `*`,
			// not treat it as a literal key returning undefined.
			const data: User = {
				name: "u",
				items: [{ name: "a" }, { name: "b" }],
			};
			expect(parent?.get(data)).toEqual([{ name: "a" }, { name: "b" }]);
		});

		it("returns a concrete Path once the remaining segments contain no wildcards", () => {
			const tmpl = path((p: User) => p.items).each();
			// segments: ["items", "*"]  → parent → ["items"] (no wildcards left)
			const parent = tmpl.parent();
			expect(parent?.segments).toEqual(["items"]);

			const data: User = {
				name: "u",
				items: [{ name: "a" }],
			};
			expect(parent?.get(data)).toEqual([{ name: "a" }]);

			// One more parent gets us to the empty root path.
			expect(parent?.parent()?.segments).toEqual([]);
		});

		it("parent() of a zero-segment path returns null", () => {
			// A TemplatePathImpl cannot have zero segments in practice, but verify
			// the general guard via a concrete root path
			const root = path<User>();
			expect(root.parent()).toBeNull();
		});
	});

	describe(".slice() / .subtract() on a template path", () => {
		it("slice() preserves wildcards and .get() still expands", () => {
			const tmpl = path((p: User) => p.items).each((i) => i.name);
			// segments: ["items", "*", "name"]
			const sliced = tmpl.slice(0, 2);
			expect(sliced.segments).toEqual(["items", WILDCARD]);

			const data: User = {
				name: "u",
				items: [{ name: "a" }, { name: "b" }],
			};
			expect(sliced.get(data)).toEqual([{ name: "a" }, { name: "b" }]);
		});

		it("slice() collapses to a concrete Path when no wildcards remain", () => {
			const tmpl = path((p: User) => p.items).each((i) => i.name);
			const sliced = tmpl.slice(0, 1);
			expect(sliced.segments).toEqual(["items"]);

			const data: User = {
				name: "u",
				items: [{ name: "a" }, { name: "b" }],
			};
			// One-element array because there's no wildcard — sliced is a concrete Path.
			expect(sliced.get(data)).toEqual([{ name: "a" }, { name: "b" }]);
		});

		it("subtract() preserves wildcards in the tail", () => {
			const tmpl = path((p: User) => p.items).each((i) => i.name);
			// segments: ["items", "*", "name"]; subtract ["items"]
			const tail = tmpl.subtract((p: User) => p.items);
			expect(tail).not.toBeNull();
			expect(tail?.segments).toEqual([WILDCARD, "name"]);

			const item = [{ name: "a" }, { name: "b" }];
			expect(tail?.get(item)).toEqual(["a", "b"]);
		});
	});

	describe(".to() / .merge() on a concrete path with a template argument", () => {
		it("concrete.to(template) preserves wildcards — .get() expands", () => {
			interface Root {
				user: { friends: Array<{ name: string }> };
			}
			const userPath = path((r: Root) => r.user);
			const friendNames = path((u: Root["user"]) => u.friends).each(
				(f) => f.name,
			);
			// Bug guarded against: concrete.to(template) used to build a PathImpl
			// whose .get() treated '*' as a literal key and returned undefined.
			const full = userPath.to(friendNames);
			expect(full.segments).toEqual(["user", "friends", WILDCARD, "name"]);

			const data: Root = {
				user: { friends: [{ name: "alice" }, { name: "bob" }] },
			};
			expect(full.get(data)).toEqual(["alice", "bob"]);
		});

		it("concrete.merge(template) preserves wildcards — .get() expands", () => {
			interface Root {
				items: Array<{ name: string }>;
			}
			const base = path((r: Root) => r.items);
			const tmpl = path((r: Root) => r.items).each((i) => i.name);
			const merged = base.merge(tmpl);
			// mergeSegments deduplicates "items" overlap → ["items", "*", "name"]
			expect(merged.segments).toEqual(["items", WILDCARD, "name"]);

			const data: Root = { items: [{ name: "a" }, { name: "b" }] };
			expect(merged.get(data)).toEqual(["a", "b"]);
		});

		it("concrete.to({segments}) treats '*' as a literal key, not a wildcard", () => {
			// {segments} is unstructured — we can't tell whether '*' was meant
			// as a wildcard or a literal property key. Resolve in favour of
			// the literal so real '*' keys still work; callers who want
			// wildcards must pass a TemplatePath built via .each()/.deep().
			interface Root {
				items: Record<string, { name: string }>;
			}
			const base = path((r: Root) => r.items);
			const full = base.to({ segments: ["*", "name"] });
			expect(full.segments).toEqual(["items", "*", "name"]);

			const data: Root = {
				items: { "*": { name: "literal-star" }, other: { name: "x" } },
			};
			expect(full.get(data)).toBe("literal-star");
		});

		it("concrete.to(lambda accessing '*' key) treats '*' as literal", () => {
			interface Root {
				a: Record<string, number>;
			}
			const p = path((r: Root) => r.a).to((x) => x["*"]);
			const data: Root = { a: { "*": 1, b: 2 } };
			expect(p.get(data)).toBe(1);
		});

		it("concrete.to(unsafePath('*')) treats '*' as a literal key", () => {
			interface Root {
				a: Record<string, number>;
			}
			const p = path((r: Root) => r.a).to(unsafePath<{ "*": number }>("*"));
			const data: Root = { a: { "*": 1, b: 2 } };
			expect(p.get(data)).toBe(1);
		});

		it("concrete.merge(concrete with literal '*') stays concrete", () => {
			interface Root {
				a: Record<string, number>;
			}
			const head = path((r: Root) => r.a);
			const tail = path((x: { "*": number }) => x["*"]);
			const merged = head.merge(tail as never);
			const data: Root = { a: { "*": 1, b: 2 } };
			expect(merged.get(data)).toBe(1);
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
});
