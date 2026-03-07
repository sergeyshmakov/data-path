/**
 * Runtime tests for .get() and .set().
 * @see spec/idea.md §9
 */

import { describe, expect, it } from "vitest";
import { path } from "../index.js";

interface Shop {
    products: Array<{
        id: string;
        photos: Array<{ id: string; url: string }>;
    }>;
}

describe("Data access", () => {
    describe(".get()", () => {
        it("retrieves nested properties", () => {
            const p = path((x: { a: { b: { c: string } } }) => x.a.b.c);
            const data = { a: { b: { c: "hello" } } };
            expect(p.get(data)).toBe("hello");
        });

        it("handles arrays", () => {
            const p = path((x: { items: string[] }) => x.items[1]);
            const data = { items: ["a", "b", "c"] };
            expect(p.get(data)).toBe("b");
        });

        it("returns undefined when intermediate objects are missing", () => {
            const p = path<{ a?: { b?: { c: string } } }>(
                (x) => (x as { a: { b: { c: string } } }).a.b.c,
            );
            const data = { a: undefined };
            expect(p.get(data)).toBeUndefined();
        });

        it("immutability: does not mutate original path", () => {
            const p = path((x: { a: { b: { c: string } } }) => x.a.b.c);
            const data = { a: { b: { c: "hello" } } };
            p.get(data);
            expect(p.segments).toEqual(["a", "b", "c"]);
        });
    });

    describe(".set()", () => {
        it("immutably updates nested property", () => {
            const p = path((x: { a: { b: number } }) => x.a.b);
            const data = { a: { b: 1 } };
            const updated = p.set(data, 42);
            expect(updated.a.b).toBe(42);
            expect(data.a.b).toBe(1);
        });

        it("immutability: does not mutate original path", () => {
            const p = path((x: { a: { b: number } }) => x.a.b);
            const data = { a: { b: 1 } };
            p.set(data, 42);
            expect(p.segments).toEqual(["a", "b"]);
        });

        describe("deep immutability and structural sharing", () => {
            const getFixture = (): Shop => ({
                products: [
                    {
                        id: "p1",
                        photos: [
                            { id: "ph1_1", url: "url1_1" },
                            { id: "ph1_2", url: "url1_2" },
                        ],
                    },
                    {
                        id: "p2",
                        photos: [{ id: "ph2_1", url: "url2_1" }],
                    },
                ],
            });

            it("creates new references only along the updated path", () => {
                const data = getFixture();
                const p = path((x: Shop) => x.products[0].photos[1].url);

                const updated = p.set(data, "new_url");

                // Value is updated
                expect(updated.products[0].photos[1].url).toBe("new_url");
                // Original is unchanged
                expect(data.products[0].photos[1].url).toBe("url1_2");

                // Root reference changed
                expect(updated).not.toBe(data);
                // Array reference changed
                expect(updated.products).not.toBe(data.products);
                // Object reference changed
                expect(updated.products[0]).not.toBe(data.products[0]);
                // Inner array reference changed
                expect(updated.products[0].photos).not.toBe(
                    data.products[0].photos,
                );
                // Inner object reference changed
                expect(updated.products[0].photos[1]).not.toBe(
                    data.products[0].photos[1],
                );
            });

            it("preserves original references for unchanged branches (structural sharing)", () => {
                const data = getFixture();
                const p = path((x: Shop) => x.products[0].photos[1].url);

                const updated = p.set(data, "new_url");

                // Unchanged sibling in the products array is reused
                expect(updated.products[1]).toBe(data.products[1]);
                // Unchanged primitive/reference in the modified product object is reused
                expect(updated.products[0].id).toBe(data.products[0].id);
                // Unchanged sibling in the modified photos array is reused
                expect(updated.products[0].photos[0]).toBe(
                    data.products[0].photos[0],
                );
            });
        });
    });

    describe("unexpected cases", () => {
        it(".get(null) and .get(undefined) gracefully returns undefined", () => {
            const p = path((x: { a: number }) => x.a);
            expect(p.get(null as any)).toBeUndefined();
            expect(p.get(undefined as any)).toBeUndefined();
        });

        it(".get() and .set() handle unexpected structures safely", () => {
            const p = path((x: { a: { b: number } }) => x.a.b);
            // Trying to traverse into a string
            expect(p.get({ a: "string" } as any)).toBeUndefined();

            // Trying to set into a string replaces the string with an object/array at that level?
            // Or at least it doesn't crash the host program unexpectedly.
            expect(() => p.set({ a: "string" } as any, 42)).not.toThrow();
        });

        it("records 'then' as a normal path segment", () => {
            const p = path((x: { then: { value: string } }) => x.then.value);
            // biome-ignore lint/suspicious/noThenProperty: testing that 'then' is recorded as a normal path segment
            const data = { then: { value: "resolved" } };
            expect(p.get(data)).toBe("resolved");
            expect(p.segments).toEqual(["then", "value"]);
        });

        it("preserves numeric-looking object keys as strings (e.g. '01', '1e3')", () => {
            // "01" and "1" are distinct keys in JS; "1e3" and "1000" are distinct
            const p01 = path((x: { "01": string }) => x["01"]);
            const p1e3 = path((x: { "1e3": number }) => x["1e3"]);
            const data = {
                "01": "value-01",
                1: "value-1",
                "1e3": 1000,
                1000: 999,
            };
            expect(p01.get(data)).toBe("value-01");
            expect(p1e3.get(data)).toBe(1000);
            expect(p01.segments).toEqual(["01"]);
            expect(p1e3.segments).toEqual(["1e3"]);
        });

        it("Array .set() operations with out-of-bounds indices or negative indices", () => {
            const p = path((x: { items: string[] }) => x.items[5]);
            const data = { items: ["a"] };
            const result = p.set(data, "f");
            expect(result.items[5]).toBe("f");
            expect(result.items.length).toBeGreaterThan(1);

            // Negative index behavior checks
            const pNeg = path((x: { items: string[] }) => x.items[-1]);
            expect(() => pNeg.set(data, "z")).not.toThrow();
        });
    });

    describe("typing incorrect cases", () => {
        it("rejects .set() with a wrong type", () => {
            const p = path((x: { a: number }) => x.a);
            const data = { a: 1 };
            // @ts-expect-error
            p.set(data, "wrong-type");
        });
    });
});
