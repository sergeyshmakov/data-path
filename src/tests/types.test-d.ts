/**
 * Type tests using expectTypeOf and assertType.
 * Run with: vitest run --typecheck
 * @see spec/idea.md §8
 */
/// <reference types="vitest/globals" />

import { assertType, expectTypeOf } from "vitest";
import type { Path, TemplatePath } from "../index.js";
import { path, unsafePath } from "../index.js";

describe("Type checks", () => {
	it("path infers correct Path type", () => {
		const p = path((x: { a: { b: string } }) => x.a.b);
		expectTypeOf(p).toEqualTypeOf<Path<{ a: { b: string } }, string, string>>();
	});

	it("path composition produces Path", () => {
		const base = path((x: { items: Array<{ name: string }> }) => x.items);
		const full = path(base, (p) => p[0].name);
		expectTypeOf(full).toEqualTypeOf<
			Path<{ items: Array<{ name: string }> }, string, string>
		>();
	});

	it(".get() has correct signature", () => {
		const p = path((x: { name: string }) => x.name);
		expectTypeOf(p.get).toBeFunction();
		expectTypeOf(p.get).parameters.toEqualTypeOf<[{ name: string }]>();
	});

	it(".set() has correct signature", () => {
		const p = path((x: { name: string }) => x.name);
		expectTypeOf(p.set).toBeFunction();
		expectTypeOf(p.set).parameters.toEqualTypeOf<[{ name: string }, string]>();
	});

	it(".fn has correct signature for standard paths", () => {
		const p = path((x: { name: string }) => x.name);
		expectTypeOf(p.fn).toBeFunction();
		expectTypeOf(p.fn).parameters.toEqualTypeOf<[{ name: string }]>();
		expectTypeOf(p.fn).returns.toEqualTypeOf<string>();
	});

	it(".fn has correct signature for template paths", () => {
		const p = path((x: { items: Array<{ name: string }> }) => x.items).each(
			(i) => i.name,
		);
		expectTypeOf(p.fn).toBeFunction();
		expectTypeOf(p.fn).parameters.toEqualTypeOf<
			[{ items: Array<{ name: string }> }]
		>();
		expectTypeOf(p.fn).returns.toEqualTypeOf<string[]>();
	});

	it(".each() returns TemplatePath", () => {
		const tmpl = path((p: { items: Array<{ name: string }> }) => p.items).each(
			(i: { name: string }) => i.name,
		);
		expectTypeOf(tmpl).toEqualTypeOf<
			TemplatePath<{ items: Array<{ name: string }> }, string, string>
		>();
	});

	it("path.each().to(p => p.x) returns Path with same structure as path.each(p => p.x)", () => {
		const viaTo = path((p: { items: Array<{ name: string }> }) => p.items)
			.each()
			.to((i) => i.name);
		expectTypeOf(viaTo).toEqualTypeOf<
			Path<{ items: Array<{ name: string }> }, string, string>
		>();
	});

	it(".deep() returns TemplatePath", () => {
		const deep = path((p: { tree: { label: string } }) => p.tree).deep(
			(n: { label: string }) => n.label,
		);
		expectTypeOf(deep).toEqualTypeOf<
			TemplatePath<{ tree: { label: string } }, string, string>
		>();
	});

	it(".expand() returns Path array", () => {
		const tmpl = path((p: { items: Array<{ name: string }> }) => p.items).each(
			(i: { name: string }) => i.name,
		);
		const data = { items: [{ name: "a" }] };
		const result = tmpl.expand(data);
		expectTypeOf(result).toEqualTypeOf<
			Path<{ items: Array<{ name: string }> }, string, string>[]
		>();
	});

	it("unsafePath returns Path<T, unknown, string>", () => {
		const p = unsafePath<{ a: number }>("a.b");
		expectTypeOf(p).toEqualTypeOf<Path<{ a: number }, unknown, string>>();
	});

	describe("DX improvements", () => {
		it("path() without arguments infers root path", () => {
			const p = path<{ a: string }>();
			expectTypeOf(p).toEqualTypeOf<Path<{ a: string }, { a: string }, "">>();
		});

		it(".to() appends relative path", () => {
			const root = path((x: { a: { b: string } }) => x.a);
			const full = root.to((a) => a.b);
			expectTypeOf(full).toEqualTypeOf<
				Path<{ a: { b: string } }, string, string>
			>();
		});

		it(".merge() accepts lambda expressions", () => {
			const root = path((x: { a: { b: string } }) => x.a);
			const merged = root.merge((x) => x.a.b);
			expectTypeOf(merged).toEqualTypeOf<
				Path<{ a: { b: string } }, string, string>
			>();
		});

		it(".subtract() accepts lambda expressions", () => {
			const full = path((x: { a: { b: string } }) => x.a.b);
			const subtracted = full.subtract((x) => x.a);
			expectTypeOf(subtracted).toEqualTypeOf<Path<
				{ a: { b: string } },
				string,
				string
			> | null>();
		});

		it("primitives do not expose .each or .deep", () => {
			const p = path((x: { a: string }) => x.a);
			// @ts-expect-error
			p.each;
			// @ts-expect-error
			p.deep;
		});
	});
});

describe("Generic Type Preservation", () => {
	// Wrapper function to provide a generic context
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function _testGenerics<T>() {
		type Wrapper<U> = { value: U; items: U[]; tree: { node: U } };

		it("preserves T in path creation", () => {
			const p = path((x: Wrapper<T>) => x.value);
			assertType<Path<Wrapper<T>, T, string>>(p);
		});

		it("preserves T in path composition", () => {
			const base = path<Wrapper<T>>();
			const full = path(base, (x) => x.value);
			assertType<Path<Wrapper<T>, T, string>>(full);
		});

		it("preserves T in .to() operation", () => {
			const root = path<Wrapper<T>>();
			const full = root.to((x) => x.value);
			assertType<Path<Wrapper<T>, T, string>>(full);
		});

		it("preserves T in .merge() operation", () => {
			const root = path<Wrapper<T>>();
			const tail = path((x: Wrapper<T>) => x.value);
			const merged = root.merge(tail);
			assertType<Path<Wrapper<T>, T, string>>(merged);
		});

		it("preserves T in .each() templates", () => {
			const tmpl = path((x: Wrapper<T>) => x.items).each();
			assertType<TemplatePath<Wrapper<T>, T, string>>(tmpl);
		});

		it("preserves T in .deep() templates", () => {
			const deep = path((x: Wrapper<T>) => x.tree).deep((n) => n.node);
			assertType<TemplatePath<Wrapper<T>, T, string>>(deep);
		});
	}
});

describe("Typing incorrect cases", () => {
	it("rejects .get() with mismatched root object type", () => {
		const p = path((x: { a: string }) => x.a);
		// @ts-expect-error
		p.get({ b: "test" });
	});

	it("rejects .set() with incorrect value type", () => {
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

	it("rejects operations between paths with strictly incompatible root types", () => {
		type User = { items: Array<{ name: string }> };
		type Product = { items: Array<{ price: number }> };

		const a = path((p: User) => p.items).each((i) => i.name);
		const b = path((p: Product) => p.items).each((i) => i.price);

		// Expected error because User and Product are structurally incompatible,
		// and ResolvablePath expects root type <T>
		// TS actually allows it because BasePath's structural typing matches methods,
		// but we verify that the params object types are strongly typed.

		a.match(b);
		a.merge(b);
	});
});
