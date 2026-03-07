---
name: data-path
description: Creates and manipulates type-safe object property paths using TypeScript lambda expressions. Use when the user needs typed paths for nested forms (React Hook Form, TanStack Form), state updates (Zustand, useState), validation mapping (Zod), or column accessors (TanStack Table). Use when replacing string paths like "users.0.name" with type-safe alternatives. Don't use for lodash.get, JSONPath, or simple one-level property access.
---

# `data-path` skill

Provides type-safe object property paths via Proxy-based lambda expressions. Paths are inferred from TypeScript types and support get/set, merge/subtract, templates (wildcards), and relational algebra.

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
3. Define a path with a lambda: `path<RootType>(p => p.nested.field)`
4. Use `path.$` for string form (e.g. `register(path.$)`), `path.get(data)` to read, `path.set(data, value)` to write

## Step-by-Step Workflows

### Workflow 1: Form Field Binding

When binding a nested form field (React Hook Form, TanStack Form):

1. Define the form value type (e.g. `FormValues`).
2. Create the path with the loop index in the lambda: `path<FormValues>(p => p.users[i].firstName)`.
3. Pass `path.$` to `register()` (React Hook Form) or `name` prop (TanStack Form).
4. Do not create the path outside the map callback—the index `i` must be captured inside the lambda.

### Workflow 2: Immutable State Update

When updating nested state (Zustand, useState):

1. Create the path once at module scope: `const themePath = path<State>(p => p.settings.profile.theme)`.
2. In the setter: `set(state => themePath.set(state, newValue))`.
3. `path.set()` returns a structural clone; no manual spreading required.

### Workflow 3: Validation Error Mapping (Zod)

When mapping Zod errors to UI fields:

1. Create the expected path: `path<FormData>(p => p.user.age)`.
2. For each `issue` in `result.error.issues`, build a path from `issue.path`: `unsafePath<FormData>(issue.path.join("."))`.
3. Compare: `if (errorPath.equals(agePath)) { /* show error */ }`.

### Workflow 4: Bulk Operations (Templates)

When operating on all items in a collection:

1. Create a template: `path<Data>(p => p.users).each(u => u.name)`.
2. `path.$` becomes `"users.*.name"`.
3. Use `templatePath.get(data)` → array of values; `templatePath.set(data, value)` → updates all matches.
4. Use `templatePath.expand(data)` to get concrete paths for each match.

### Workflow 5: Composing Paths (Reusable Components)

When a component receives a base path and needs to extend it:

1. Base path: `employeePath = path<Company>(p => p.departments[0].employees[5])`.
2. Sub-path: `nameSubPath = path<Employee>(p => p.profile.firstName)`.
3. Merge: `absolutePath = employeePath.merge(nameSubPath)`.
4. Subtract for relative: `relative = absolutePath.subtract(employeePath)`.

## Key Rules

- **Lambda captures at creation time**: Use `path<T>(p => p.users[i].name)` with `i` from the enclosing scope. The path is built once when the lambda runs.
- **Use `unsafePath` only for dynamic strings**: e.g. from `issue.path.join(".")` or API responses. Prefer `path()` for static structure.
- **`.get()` returns `undefined`** if any intermediate segment is missing; it does not throw.
- **`.set()` is immutable**: Returns a new object. Use with functional updaters.
- **`.each()` and `.deep()`** require a non-primitive value at the path; they are not available on paths ending in string/number/etc.

## API Reference

For the full API cheatsheet (creation, properties, data access, traversal, manipulation, relational), see [references/api.md](references/api.md).

## Common Integrations

| Integration      | Use `path.$` for | Use `path.get`/`path.set` for |
|------------------|------------------|-------------------------------|
| React Hook Form  | `register(name)` | —                             |
| TanStack Form    | `Field name`     | —                             |
| Zustand          | —                | `set(state => path.set(state, v))` |
| useState         | —                | `setState(prev => path.set(prev, v))` |
| TanStack Table   | `id` in accessor | `accessor: path.fn`           |
| Zod              | —                | `unsafePath(issue.path.join(".")).equals(path)` |
