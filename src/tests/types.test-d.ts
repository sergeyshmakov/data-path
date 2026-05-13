/**
 * Type-level tests using expectTypeOf and assertType.
 * Run with: vitest run --typecheck
 */
/// <reference types="vitest/globals" />

import { assertType, expectTypeOf } from "vitest";
import type {
	BasePath,
	CollectionItem,
	Path,
	ResolvedType,
	TemplatePath,
} from "../index.js";
import { path, unsafePath } from "../index.js";

// ---------------------------------------------------------------------------
// Path creation
// ---------------------------------------------------------------------------

describe("Path creation", () => {
	it("path() without arguments returns root Path<T, T>", () => {
		const p = path<{ a: string }>();
		expectTypeOf(p).toEqualTypeOf<Path<{ a: string }, { a: string }>>();
	});

	it("path(lambda) infers T and V from annotation", () => {
		const p = path((x: { a: { b: string } }) => x.a.b);
		expectTypeOf(p).toEqualTypeOf<Path<{ a: { b: string } }, string>>();
	});

	it("path<T, V>(lambda) uses explicit generics for both T and V", () => {
		// Providing only T with a lambda hits a TypeScript overload-resolution limit
		// (TS picks <T>() by type-param count), so the idiomatic ways are:
		//   • path((x: T) => ...)  — annotation form (infers both)
		//   • path<T, V>(lambda)   — both type params explicit
		const p = path<{ a: { b: string } }, string>((x) => x.a.b);
		expectTypeOf(p).toEqualTypeOf<Path<{ a: { b: string } }, string>>();
	});

	it("path(base, lambda) extends a base path", () => {
		const base = path((x: { items: Array<{ name: string }> }) => x.items);
		const full = path(base, (p) => p[0].name);
		expectTypeOf(full).toEqualTypeOf<
			Path<{ items: Array<{ name: string }> }, string>
		>();
	});
});

// ---------------------------------------------------------------------------
// Data access — get / set / fn
// ---------------------------------------------------------------------------

describe("Data access types", () => {
	it(".get() returns V | undefined", () => {
		const p = path((x: { name: string }) => x.name);
		expectTypeOf(p.get).toBeFunction();
		expectTypeOf(p.get).parameters.toEqualTypeOf<[{ name: string }]>();
		expectTypeOf(p.get).returns.toEqualTypeOf<string | undefined>();
	});

	it(".set() signature is unchanged", () => {
		const p = path((x: { name: string }) => x.name);
		expectTypeOf(p.set).toBeFunction();
		expectTypeOf(p.set).parameters.toEqualTypeOf<[{ name: string }, string]>();
	});

	it(".fn returns (data: T) => V | undefined for standard paths", () => {
		const p = path((x: { name: string }) => x.name);
		expectTypeOf(p.fn).toBeFunction();
		expectTypeOf(p.fn).parameters.toEqualTypeOf<[{ name: string }]>();
		expectTypeOf(p.fn).returns.toEqualTypeOf<string | undefined>();
	});

	it(".fn returns (data: T) => V[] for template paths", () => {
		const p = path((x: { items: Array<{ name: string }> }) => x.items).each(
			(i) => i.name,
		);
		expectTypeOf(p.fn).toBeFunction();
		expectTypeOf(p.fn).parameters.toEqualTypeOf<
			[{ items: Array<{ name: string }> }]
		>();
		expectTypeOf(p.fn).returns.toEqualTypeOf<string[]>();
	});

	it(".update() has correct signature", () => {
		const p = path((x: { name: string }) => x.name);
		expectTypeOf(p.update).toBeFunction();
		// updater receives V | undefined, returns V; result is T
		expectTypeOf(p.update).parameters.toEqualTypeOf<
			[{ name: string }, (current: string | undefined) => string]
		>();
		expectTypeOf(p.update).returns.toEqualTypeOf<{ name: string }>();
	});
});

// ---------------------------------------------------------------------------
// parent()
// ---------------------------------------------------------------------------

describe("parent()", () => {
	it("returns Path<T, unknown> | null", () => {
		const p = path((x: { a: { b: string } }) => x.a.b);
		expectTypeOf(p.parent()).toEqualTypeOf<Path<
			{ a: { b: string } },
			unknown
		> | null>();
	});

	it("root path parent() returns null at runtime (type is Path|null)", () => {
		const p = path<{ a: string }>();
		expectTypeOf(p.parent()).toEqualTypeOf<Path<
			{ a: string },
			unknown
		> | null>();
	});
});

// ---------------------------------------------------------------------------
// Template paths — each / deep / expand
// ---------------------------------------------------------------------------

describe("Template paths", () => {
	it(".each() returns TemplatePath<T, CollectionItem<V>>", () => {
		const tmpl = path((p: { items: Array<{ name: string }> }) => p.items).each(
			(i: { name: string }) => i.name,
		);
		expectTypeOf(tmpl).toEqualTypeOf<
			TemplatePath<{ items: Array<{ name: string }> }, string>
		>();
	});

	it(".each() without expr returns TemplatePath<T, CollectionItem<V>>", () => {
		const tmpl = path(
			(p: { items: Array<{ name: string }> }) => p.items,
		).each();
		expectTypeOf(tmpl).toEqualTypeOf<
			TemplatePath<{ items: Array<{ name: string }> }, { name: string }>
		>();
	});

	it(".deep() returns TemplatePath<T, U>", () => {
		const deep = path((p: { tree: { label: string } }) => p.tree).deep(
			(n: { label: string }) => n.label,
		);
		expectTypeOf(deep).toEqualTypeOf<
			TemplatePath<{ tree: { label: string } }, string>
		>();
	});

	it(".expand() returns Path<T, V>[]", () => {
		const tmpl = path((p: { items: Array<{ name: string }> }) => p.items).each(
			(i: { name: string }) => i.name,
		);
		const data = { items: [{ name: "a" }] };
		const result = tmpl.expand(data);
		expectTypeOf(result).toEqualTypeOf<
			Path<{ items: Array<{ name: string }> }, string>[]
		>();
	});

	it("template .get() returns V[]", () => {
		const tmpl = path((p: { items: Array<{ name: string }> }) => p.items).each(
			(i) => i.name,
		);
		expectTypeOf(tmpl.get).returns.toEqualTypeOf<string[]>();
	});
});

// ---------------------------------------------------------------------------
// .to() — accepts lambda and pre-built path
// ---------------------------------------------------------------------------

describe(".to()", () => {
	it(".to(lambda) appends relative path", () => {
		const root = path((x: { a: { b: string } }) => x.a);
		const full = root.to((a) => a.b);
		expectTypeOf(full).toEqualTypeOf<Path<{ a: { b: string } }, string>>();
	});

	it(".to(path object) appends a pre-built Path<V, U>", () => {
		type User = { profile: { name: string } };
		type Root = { user: User };
		// Use annotation form (not path<T>(lambda)) — see note in "path<T,V> uses explicit generics"
		const userPath = path((r: Root) => r.user);
		const namePath = path((u: User) => u.profile.name);
		const full = userPath.to(namePath);
		expectTypeOf(full).toEqualTypeOf<Path<Root, string>>();
	});

	it(".each().to(lambda) returns TemplatePath, not Path", () => {
		const viaTo = path((p: { items: Array<{ name: string }> }) => p.items)
			.each()
			.to((i) => i.name);
		expectTypeOf(viaTo).toEqualTypeOf<
			TemplatePath<{ items: Array<{ name: string }> }, string>
		>();
	});
});

// ---------------------------------------------------------------------------
// subtract() — typed prefix removal
// ---------------------------------------------------------------------------

describe("subtract()", () => {
	it("returns Path<U, V> | null where U is the prefix's resolved type", () => {
		type Company = { departments: Array<{ name: string }> };
		type Department = { name: string };
		// Use annotation form — see note in "path<T,V> uses explicit generics"
		const full = path((c: Company) => c.departments[0].name);
		const prefix = path((c: Company) => c.departments[0]);
		const result = full.subtract(prefix);
		expectTypeOf(result).toEqualTypeOf<Path<Department, string> | null>();
	});

	it("lambda form infers U from the expression", () => {
		type Company = { departments: Array<{ name: string }> };
		const full = path((c: Company) => c.departments[0].name);
		const result = full.subtract((c) => c.departments[0]);
		// U = departments element type = { name: string }
		expectTypeOf(result).toEqualTypeOf<Path<{ name: string }, string> | null>();
	});
});

// ---------------------------------------------------------------------------
// ResolvedType utility
// ---------------------------------------------------------------------------

describe("ResolvedType", () => {
	it("extracts V from a Path", () => {
		const p = path((x: { age: number }) => x.age);
		type Age = ResolvedType<typeof p>;
		expectTypeOf<Age>().toEqualTypeOf<number>();
	});

	it("extracts V from a TemplatePath", () => {
		const tmpl = path((x: { items: string[] }) => x.items).each();
		type Item = ResolvedType<typeof tmpl>;
		expectTypeOf<Item>().toEqualTypeOf<string>();
	});

	it("returns never for non-path types", () => {
		type R = ResolvedType<string>;
		expectTypeOf<R>().toEqualTypeOf<never>();
	});
});

// ---------------------------------------------------------------------------
// unsafePath<T, V>
// ---------------------------------------------------------------------------

describe("unsafePath", () => {
	it("without V generic returns Path<T, unknown>", () => {
		const p = unsafePath<{ a: number }>("a.b");
		expectTypeOf(p).toEqualTypeOf<Path<{ a: number }, unknown>>();
	});

	it("with V generic returns Path<T, V>", () => {
		const p = unsafePath<{ name: string }, string>("name");
		expectTypeOf(p).toEqualTypeOf<Path<{ name: string }, string>>();
	});

	it(".get() on typed unsafePath returns V | undefined", () => {
		const p = unsafePath<{ name: string }, string>("name");
		expectTypeOf(p.get).returns.toEqualTypeOf<string | undefined>();
	});
});

// ---------------------------------------------------------------------------
// Primitive guard — .each() / .deep() hidden on primitive paths
// ---------------------------------------------------------------------------

describe("Primitive guard", () => {
	it("primitive paths do not expose .each or .deep", () => {
		const p = path((x: { a: string }) => x.a);
		// @ts-expect-error: string is Primitive
		p.each;
		// @ts-expect-error: string is Primitive
		p.deep;
	});

	it("object paths expose .each and .deep", () => {
		const p = path((x: { items: Array<{ name: string }> }) => x.items);
		expectTypeOf(p.each).toBeFunction();
		expectTypeOf(p.deep).toBeFunction();
	});
});

// ---------------------------------------------------------------------------
// Generic type preservation
// ---------------------------------------------------------------------------

describe("Generic type preservation", () => {
	function testGenerics<T>() {
		type Wrapper<U> = { value: U; items: U[]; tree: { node: U } };

		it("preserves T in path creation", () => {
			const p = path((x: Wrapper<T>) => x.value);
			assertType<Path<Wrapper<T>, T>>(p);
		});

		it("preserves T in path composition", () => {
			const base = path<Wrapper<T>>();
			const full = path(base, (x) => x.value);
			assertType<Path<Wrapper<T>, T>>(full);
		});

		it("preserves T in .to()", () => {
			const root = path<Wrapper<T>>();
			const full = root.to((x) => x.value);
			assertType<Path<Wrapper<T>, T>>(full);
		});

		it("preserves T in .merge()", () => {
			const root = path<Wrapper<T>>();
			const tail = path((x: Wrapper<T>) => x.value);
			const merged = root.merge(tail);
			assertType<Path<Wrapper<T>, T>>(merged);
		});

		it("preserves T in .each() templates", () => {
			const tmpl = path((x: Wrapper<T>) => x.items).each();
			assertType<TemplatePath<Wrapper<T>, T>>(tmpl);
		});

		it("preserves T in .deep() templates", () => {
			const deep = path((x: Wrapper<T>) => x.tree).deep((n) => n.node);
			assertType<TemplatePath<Wrapper<T>, T>>(deep);
		});
	}

	// Call to materialise the describe block (TypeScript checks happen at parse time)
	testGenerics<string>();
});

// ---------------------------------------------------------------------------
// Incorrect usage
// ---------------------------------------------------------------------------

describe("Typing incorrect cases", () => {
	it("rejects .get() with mismatched root type", () => {
		const p = path((x: { a: string }) => x.a);
		// @ts-expect-error
		p.get({ b: "test" });
	});

	it("rejects .set() with wrong value type", () => {
		const p = path((x: { a: number }) => x.a);
		// @ts-expect-error
		p.set({ a: 1 }, "string");
	});

	it("rejects .each() and .deep() on definitively primitive types", () => {
		const p = path((x: { a: string }) => x.a);
		// @ts-expect-error
		p.each();
		// @ts-expect-error
		p.deep();
	});
});

// ---------------------------------------------------------------------------
// CollectionItem utility
// ---------------------------------------------------------------------------

describe("CollectionItem", () => {
	it("extracts array element type", () => {
		expectTypeOf<CollectionItem<string[]>>().toEqualTypeOf<string>();
	});

	it("extracts record value type", () => {
		expectTypeOf<
			CollectionItem<Record<string, number>>
		>().toEqualTypeOf<number>();
	});

	it("returns unknown for non-collections", () => {
		expectTypeOf<CollectionItem<string>>().toEqualTypeOf<unknown>();
	});
});

// ---------------------------------------------------------------------------
// BasePath type acceptance
// ---------------------------------------------------------------------------

describe("BasePath as parameter type", () => {
	it("accepts Path as BasePath", () => {
		function acceptBase<T, V>(p: BasePath<T, V>): string {
			return p.$;
		}
		const p = path((x: { name: string }) => x.name);
		assertType<string>(acceptBase(p));
	});
});
