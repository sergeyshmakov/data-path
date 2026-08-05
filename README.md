# data-path

Type-safe object property paths in TypeScript — build, compare, and manipulate with lambda expressions. Zero dependencies.

[![npm version](https://img.shields.io/npm/v/data-path.svg)](https://www.npmjs.com/package/data-path)
[![CI](https://github.com/sergeyshmakov/data-path/actions/workflows/pr.yml/badge.svg)](https://github.com/sergeyshmakov/data-path/actions/workflows/pr.yml)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/data-path)](https://bundlephobia.com/package/data-path)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Documentation:** https://path.shmakov.tools/

---

## Before / after

```ts
// Before — string literals, invisible to the compiler
register("users.0.profile.firstName");
table.getColumn("contact.email");
set(state => ({ ...state, settings: { ...state.settings, theme } }));
```

```ts
// After — typed, IDE-autocompleted, refactor-safe
register(path((u: FormData) => u.users[0].profile.firstName).$);
table.getColumn(emailPath.$);
set(state => themePath.set(state, theme));
```

## What it is

A zero-dependency TypeScript library that captures object property paths via proxy-based lambdas. Build a path once — use it as a string, read and write data through it, compose paths together, or match one against another.

- Typed root to leaf — renaming a property breaks the path at compile time
- Safe `get`, immutable `set`, read-modify-write `update`
- Template paths (`each`, `deep`) for bulk operations across collections and trees
- Path algebra: `merge`, `subtract`, `slice`, `to`
- Runtime indices and closure variables work natively inside lambdas

## Install

```bash
npm install data-path
```

Requirements: Node `>=20`, TypeScript `>=5.0`

## Quick start

```ts
import { path } from "data-path";

type User = { profile: { firstName: string; lastName: string }; tags: string[] };

const firstNamePath = path((u: User) => u.profile.firstName);

firstNamePath.$                        // "profile.firstName"
firstNamePath.get(user)                // "Alice" | undefined
firstNamePath.set(user, "Bob")         // returns a new User — original unchanged
firstNamePath.fn                       // stable (u: User) => string | undefined
```

## Works well with

| Package | How it helps |
|---------|--------------|
| [React Hook Form](https://path.shmakov.tools/integrations/react-hook-form/) | Type-safe field names for `register`, `watch`, `setValue` |
| [TanStack Form](https://path.shmakov.tools/integrations/tanstack-form/) | Typed field names with runtime index support |
| [TanStack Table](https://path.shmakov.tools/integrations/tanstack-table/) | Typed column accessors — no manual `id` strings |
| [Zustand](https://path.shmakov.tools/integrations/zustand/) | Immutable nested state updates without Immer |
| [Zod](https://path.shmakov.tools/integrations/zod/) | Map `ZodError.issues` paths to specific form fields |
| [React `useState`](https://path.shmakov.tools/integrations/react-usestate/) | Structural clones for deeply nested state |

## Guides

- [Data access](https://path.shmakov.tools/guides/data-access/) — `get`, `set`, `update`, `fn`
- [Templates](https://path.shmakov.tools/guides/templates/) — `each`, `deep`, bulk writes across collections
- [Path algebra](https://path.shmakov.tools/guides/path-algebra/) — `merge`, `subtract`, `slice`, `to`
- [Relational](https://path.shmakov.tools/guides/relational/) — `startsWith`, `covers`, `match`
- [Runtime variables](https://path.shmakov.tools/guides/runtime-variables/) — dynamic indices and closures

## AI tooling

This package is available in [Context7](https://context7.com/) and documented in a [Cubic wiki](https://www.cubic.dev/wikis/sergeyshmakov/data-path). An [Agent Skills](https://agentskills.io/)-compatible skill is included:

```bash
npx ctx7 skills install /sergeyshmakov/data-path data-path
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT License](LICENSE)
