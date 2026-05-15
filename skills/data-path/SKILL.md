---
name: data-path
description: Creates and manipulates type-safe object property paths using TypeScript lambda expressions. Use when the user needs typed paths for nested forms (React Hook Form, TanStack Form), state updates (Zustand, useState), validation mapping (Zod), or column accessors (TanStack Table). Use when replacing string paths like "users.0.name" with type-safe alternatives. Don't use for lodash.get, JSONPath, or simple one-level property access.
---

# `data-path` skill

Provides type-safe object property paths via Proxy-based lambda expressions. Paths are inferred from TypeScript types and support get/set/update, merge/subtract, templates (wildcards), relational algebra, and parent/child navigation.

## When to Apply

Trigger when the user:
- Binds form fields to nested structures (e.g. `users[i].firstName`)
- Updates deeply nested state immutably
- Maps validation errors to specific fields
- Defines table column accessors
- Compares or composes paths programmatically

Do not trigger for:
- Simple `obj.prop` access
- lodash.get / lodash.set usage
- JSONPath or XPath-style queries
- Non-TypeScript projects

## Quick Start

1. Ensure `data-path` is installed: `npm install data-path`
2. Import: `import { path, unsafePath } from "data-path"`
3. Define a path with a lambda: `path((u: User) => u.profile.field)`
4. Use `path.$` for string form (e.g. `register(path.$)`), `path.get(data)` to read, `path.set(data, value)` to write immutably, `path.update(data, fn)` for read-modify-write

## Step-by-Step Workflows

### Workflow 1: Form Field Binding

When binding a nested form field (React Hook Form, TanStack Form):

1. Define the form value type (e.g. `FormValues`).
2. Create the path with the loop index in the lambda: `path((p: FormValues) => p.users[i].firstName)`.
3. Pass `path.$` to `register()` (React Hook Form) or `name` prop (TanStack Form).
4. Do not create the path outside the map callback — the index `i` must be captured inside the lambda.

### Workflow 2: Immutable State Update

When updating nested state (Zustand, useState):

1. Create the path once at module scope: `const themePath = path((s: State) => s.settings.profile.theme)`.
2. For a direct set: `set(state => themePath.set(state, newValue))`.
3. For a transform: `set(state => themePath.update(state, t => t === "light" ? "dark" : "light"))`.
4. `path.set()` and `path.update()` both return a structural clone — no manual spreading required.

### Workflow 3: Validation Error Mapping (Zod)

When mapping Zod errors to UI fields:

1. Create the expected path: `const agePath = path((p: FormData) => p.user.age)`.
2. Pass `issue.path` directly as `{ segments }` (do NOT `join(".")` then `unsafePath` — that loses keys containing literal `.`).
3. Compare: `if (agePath.equals({ segments: issue.path })) { /* show error */ }`.

### Workflow 4: Bulk Operations (Templates)

When operating on all items in a collection:

1. Create a template: `path((p: Data) => p.users).each(u => u.name)`.
2. `templatePath.$` becomes `"users.*.name"`.
3. Use `templatePath.get(data)` → `string[]` of all values; `templatePath.set(data, value)` → updates all matches.
4. Use `templatePath.expand(data)` to get concrete paths for each match.

### Workflow 5: Composing Paths (Reusable Components)

When a component receives a base path and needs to extend it:

1. Base path: `const employeePath = path((c: Company) => c.departments[0].employees[5])`.
2. Extend with `.to()`: `employeePath.to(e => e.profile.firstName)`.
3. Or merge with another path: `employeePath.merge(firstNamePath)` (handles segment overlap).
4. Subtract for a relative path: `fullPath.subtract(employeePath)` — returns `Path<Employee, V>` or `null`.

### Workflow 6: Path Navigation

When you need to navigate up or extract a sub-section of a path:

1. **Parent**: `path((u: User) => u.profile.name).parent()` returns a `Path<User, unknown>` whose segments are `["profile"]` (use `.parent()?.$` if you want the string `"profile"`). Returns `null` at root — always guard with `?.` when chaining: `p.parent()?.parent()`.
2. **Slice**: `p.slice(start?, end?)` follows `Array.prototype.slice` on the segment array. `p.slice(0, 2)` takes the first two segments; `p.slice(-2)` takes the last two. Useful for extracting dynamic sub-paths.
3. **Subtract for typed prefix removal**: see Workflow 5 — `subtract` changes the root type from the full-path root to the resolved type of the prefix.

## Key Rules

- **Lambda captures at creation time**: Use `path((p: T) => p.users[i].name)` with `i` from the enclosing scope. The path is built once when the lambda runs.
- **Use `unsafePath` only for raw dot-separated strings from external sources** (API responses, persisted paths, query params). Do NOT use `unsafePath(arr.join("."))` to convert a segment array — `unsafePath` re-splits on `.` and corrupts field names containing a literal `.`. Pass `{segments: arr}` directly to relational/algebra methods, or build a path via `path<T>().to({segments: arr})` if you need a `Path` instance. Prefer `path()` for static structure.
- **`*` / `**` in `unsafePath` and `{segments}` are literal keys**: Wildcards inserted by `.each()`/`.deep()` are unique `Symbol` sentinels (`WILDCARD` / `DEEP_WILDCARD` exports), not the strings. `unsafePath("a.*.b")`, `{segments: ["*"]}`, and `(x) => x["*"]` all do literal key lookups. The only way to get wildcard expansion is `.each()` / `.deep()` (or constructing `{segments: [WILDCARD]}` explicitly).
- **`.get()` returns `undefined`** if any intermediate segment is missing; it does not throw.
- **`.set()` and `.update()` are immutable**: Both return a new object. Use with functional updaters.
- **`.each()` and `.deep()`** require a non-primitive value at the path; they are not available on paths ending in `string`, `number`, etc.
- **`.parent()` returns `null` at root**: Always guard with optional chaining when chaining: `p.parent()?.parent()`.
- **`.slice(start?, end?)` uses array semantics**: Negative indices count from the end of the segment array; returns `Path<T, unknown>` on a plain `Path`. On a `TemplatePath` the return widens to `Path<T, unknown> | TemplatePath<T, unknown>` so wildcards are preserved when present.
- **`ResolvablePath` is accepted everywhere**: `.to()`, `.merge()`, `.subtract()`, `.startsWith()`, `.covers()`, `.equals()`, and `.match()` all accept a lambda, a pre-built `Path` or `TemplatePath`, or a `{segments}` object.
- **Wildcard-preserving composition**: `.to(relative)` and `.merge(other)` on a plain `Path` return `Path<T, U> | TemplatePath<T, U>` — a `TemplatePath` when the argument carries `*` / `**`, otherwise a `Path`. Likewise `TemplatePath.parent()`, `.slice()`, `.subtract()` widen to `Path | TemplatePath [| null]`. Narrow at the call site if you need to disambiguate.
- **TemplatePath overrides**: On a `TemplatePath`, `.get()` returns `V[]`, `.fn` returns `(data: T) => V[]`, `.to()` and `.merge()` always return `TemplatePath` (because `this` already carries wildcards).

## API Reference

For the full API cheatsheet (creation, properties, data access, navigation, traversal, manipulation, relational), see [references/api.md](references/api.md).

## Common Integrations

| Integration      | Use `path.$` for | Use `path.get`/`path.set`/`path.update` for |
|------------------|------------------|-------------------------------|
| React Hook Form  | `register(name)` | — |
| TanStack Form    | `Field name`     | — |
| Zustand          | —                | `set(state => path.set(state, v))` |
| useState         | —                | `setState(prev => path.update(prev, fn))` |
| TanStack Table   | `id` in accessor | `accessor: path.fn` |
| Zod              | —                | `path.equals({ segments: issue.path })` |
