# data-path

A simple, modern, zero-dependency, and fully type-safe library for building, comparing, and manipulating object property paths using TypeScript lambda expressions.

[![npm version](https://badge.fury.io/js/data-path.svg)](https://badge.fury.io/js/data-path)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## ⚠️ The Problem

When working with deep object structures, forms, or nested state, we often rely on string-based paths (e.g., `"users.0.name"` or `"company.departments[1].budget"`). This approach is fundamentally flawed in modern TypeScript development:

- **No Type Safety:** String paths are opaque to the compiler. A typo goes unnoticed until runtime.
- **Refactoring Nightmares:** Renaming a property doesn't update string literals scattered across your codebase.
- **No Autocomplete:** Your IDE cannot guide you through the object structure.
- **No Mathematics:** It is difficult to programmatically determine if path `A` is a child of path `B`, or if they overlap.

## 🚀 The Solution

`data-path` solves this by using **Proxy-based lambda expressions** to capture paths. It gives you 100% type safety, IDE autocomplete, and a rich API for interacting with data and other paths.

```typescript
import { path } from "data-path";

type User = {
    id: string;
    profile: {
        firstName: string;
        lastName: string;
    };
    tags: string[];
};

// 1. Create a path with full IDE autocomplete
const firstNamePath = path<User>(p => p.profile.firstName);

// 2. Output as a string (e.g., for form libraries)
console.log(firstNamePath.$); // "profile.firstName"

// 3. Read data safely (no "Cannot read properties of undefined" errors)
const user = {
    id: "1",
    profile: { firstName: "Alice", lastName: "Smith" },
    tags: [],
};
console.log(firstNamePath.get(user)); // "Alice"

// 4. Update data immutably (returns a new structural clone)
const updatedUser = firstNamePath.set(user, "Bob");
console.log(updatedUser.profile.firstName); // "Bob"
```

## 📦 Installation

```bash
npm install data-path
```

_(or use `yarn add data-path`, `pnpm add data-path`, `bun add data-path`)_

## 🤖 AI Ready

This package is available in [Context7](https://context7.com/) MCP, so AI assistants can load it directly into context when working with your object property paths.

It also ships an [Agent Skills](https://agentskills.io/) – compatible skill. Install it so your AI assistant loads data-path guidance:

```bash
npx ctx7 skills install /sergeyshmakov/data-path data-path
```

The skill lives in `skills/data-path/SKILL.md`.

## 💡 Philosophy

- **Stack Agnostic:** Pure data manipulation. Works perfectly with React, Vue, Node.js, or vanilla JavaScript.
- **Zero Dependencies:** A tiny, efficient footprint that doesn't bloat your bundle.
- **Fully Type-Safe:** Built strictly for TypeScript. If the structure changes, the compiler will instantly catch broken paths.
- **Immutable:** All `.set()` operations return structurally cloned objects, making it the perfect companion for modern state managers (Redux, Zustand) and reactive frameworks.

## 📚 Core API

### 🏷️ API Cheatsheet

| API | Description |
|-----|-------------|
| **Creation** | |
| `path<T>()` | Create root path |
| `path<T>(p => p.a.b)` | Create path from lambda |
| `path(base, p => p.c)` | Extend existing path |
| `unsafePath<T>("a.b")` | Create path from raw string |
| **Properties** | |
| `path.$` | String representation (e.g. `"users.0.name"`) |
| `path.segments` | Array of segments |
| `path.length` | Number of segments |
| `path.fn` | Accessor function for `.map()`, `.filter()` |
| **Data Access** | |
| `path.get(data)` | Read value at path (returns `undefined` if missing) |
| `path.set(data, value)` | Immutable write, returns new object |
| **Traversal** | |
| `path.to(p => p.x)` | Extend path from current value |
| `path.each(p => p.x)` | Template: match all items in collection |
| `path.deep(node => node.id)` | Template: match property at any depth |
| **Manipulation** | |
| `path.merge(other)` | Append path (deduplicates overlap) |
| `path.subtract(other)` | Remove prefix/suffix, or `null` |
| `path.slice(start?, end?)` | Slice segments (like `Array.prototype.slice`) |
| **Relational** | |
| `path.startsWith(other)` | True if path is prefix |
| `path.includes(other)` | True if path contains other |
| `path.equals(other)` | True if paths are identical |
| `path.match(other)` | Returns `{ relation, params }` or `null` |
| **Template-only** | |
| `templatePath.expand(data)` | Resolve template to concrete paths |

### Path Creation

You can create paths starting from the root of a type, using a lambda expression, or unsafely from a raw string.

```typescript
// From root
const root = path<User>();
const profile = root.to(p => p.profile);

// Direct lambda
const tagsPath = path<User>(p => p.tags[0]);

// From raw string (dynamic contexts)
import { unsafePath } from "data-path";
const dynamicPath = unsafePath<User>("profile.firstName");
```

### Data Access

```typescript
const namePath = path<User>(p => p.profile.firstName);

// Read
namePath.get(user); // "Alice"

// Accessor shorthand (perfect for arrays)
const users = [user1, user2];
const names = users.map(namePath.fn);

// Write (Immutable)
const updated = namePath.set(user, "Alice 2.0");
```

### Manipulation

You can programmatically compose, subtract, and slice paths. This is ideal when working with reusable components that don't know their absolute location in a global store.

```typescript
// 1. We have a specific record's path
const employeePath = path<Company>(p => p.departments[0].employees[5]);

// 2. We have a generic sub-path
const nameSubPath = path<Employee>(p => p.profile.firstName);

// Merge them! (Smart deduplication if they overlap)
const absoluteNamePath = employeePath.merge(nameSubPath);
console.log(absoluteNamePath.$); // "departments.0.employees.5.profile.firstName"

// Subtract a base path to find the relative path
const relative = absoluteNamePath.subtract(employeePath);
console.log(relative?.$); // "profile.firstName"

// Slice segments (just like Array.prototype.slice)
const sliced = absoluteNamePath.slice(0, 3);
console.log(sliced.$); // "departments.0.employees"
```

### Templates & Wildcards

Templates allow you to target multiple elements at once (e.g., all items in an array, or all properties matching a name deep in a tree). This unlocks powerful bulk-operations.

```typescript
type AppData = { users: Array<{ id: string; name: string }> };
const data: AppData = {
    users: [
        { id: "1", name: "Alice" },
        { id: "2", name: "Bob" },
    ],
};

// 1. Create a template targeting ALL users
const allUsersPath = path<AppData>(p => p.users).each();
console.log(allUsersPath.$); // "users.*"

// 2. Create a template targeting ALL user names
const allNamesPath = path<AppData>(p => p.users).each(u => u.name);
console.log(allNamesPath.$); // "users.*.name"

// 3. Bulk Read: extract an array of all matched values
const names = allNamesPath.get(data);
console.log(names); // ["Alice", "Bob"]

// 4. Bulk Write: immutably update all matches in one go!
const anonymizedData = allNamesPath.set(data, "Hidden");
console.log(anonymizedData.users[0].name); // "Hidden"
console.log(anonymizedData.users[1].name); // "Hidden"

// 5. Expand: resolve the template into concrete paths based on actual data
const concretePaths = allNamesPath.expand(data);
console.log(concretePaths.map(p => p.$));
// ["users.0.name", "users.1.name"]

// 6. Deep Scan: target a property at any depth
const deepIds = path<AppData>().deep(node => node.id);
console.log(deepIds.$); // "**.id"
```

### Runtime Variables & Indices

Because `data-path` executes the lambda once during creation to build the path, you can seamlessly use runtime variables, indexers, and local scope variables directly inside the path definition.

```typescript
function getUserPropertyPath(userIdx: number, property: "name" | "email") {
    // Capture function arguments directly in the path!
    return path<AppData>(p => p.users[userIdx][property]);
}

const namePath = getUserPropertyPath(2, "name");
console.log(namePath.$); // "users.2.name"

const emailPath = getUserPropertyPath(5, "email");
console.log(emailPath.$); // "users.5.email"
```

### Relational Algebra

Path algebra is extremely useful for permissions, validation, and complex UI logic where you need to know how two paths relate to each other.

```typescript
const userPath = path<User>();
const profilePath = userPath.to(p => p.profile);
const namePath = userPath.to(p => p.profile.firstName);

// Check relationships
namePath.startsWith(profilePath); // true
profilePath.includes(namePath); // true
namePath.includes(profilePath); // false
namePath.equals(namePath); // true

// .match() provides detailed relational context:
// returns 'includes', 'included-by', 'equals', 'parent', 'child', or null
namePath.match(profilePath); // { relation: 'child', params: {} }
profilePath.match(namePath); // { relation: 'parent', params: {} }
```

## 💼 Real-World Examples

### 1. React Hook Form

Bind deeply nested fields with 100% type safety. Use runtime indices (like `i` from `useFieldArray`'s map) directly inside the path lambda. React Hook Form's `register` accepts dot-notation names (e.g. `users.0.firstName`).

```tsx
import { useForm, useFieldArray } from "react-hook-form";
import { path } from "data-path";

type FormValues = { users: Array<{ id: string; firstName: string }> };

function UsersForm() {
    const { register, control } = useForm<FormValues>({
        defaultValues: { users: [{ id: "1", firstName: "" }] },
    });
    const { fields } = useFieldArray({ control, name: "users" });

    return (
        <form>
            {fields.map((field, i) => {
                const namePath = path<FormValues>(p => p.users[i].firstName);
                return (
                    <input
                        key={field.id}
                        {...register(namePath.$)}
                        placeholder="First name"
                    />
                );
            })}
        </form>
    );
}
```

### 2. TanStack Form

Define exact field accessors for complex interactive forms, even inside deeply nested arrays. TanStack Form's `Field` uses `name` (dot-notation for nested paths) and a render prop with `field.state.value` and `field.handleChange`.

```tsx
import { useForm } from "@tanstack/react-form";
import { path } from "data-path";

type FormValues = { users: Array<{ firstName: string }> };

function UsersForm() {
    const form = useForm<FormValues>({
        defaultValues: { users: [{ firstName: "" }] },
        onSubmit: ({ value }) => console.log(value),
    });

    return (
        <form>
            {form.state.values.users.map((_, i) => {
                const namePath = path<FormValues>(p => p.users[i].firstName);
                return (
                    <form.Field key={i} name={namePath.$}>
                        {field => (
                            <input
                                name={field.name}
                                value={field.state.value}
                                onChange={e =>
                                    field.handleChange(e.target.value)
                                }
                            />
                        )}
                    </form.Field>
                );
            })}
        </form>
    );
}
```

### 3. Zustand

Update deeply nested state easily without needing Immer. Pass a function to `set` that receives the current state and returns the updated state via `path.set()`.

```typescript
import { create } from "zustand";
import { path } from "data-path";

type StoreState = {
    settings: { profile: { theme: string } };
    setTheme: (theme: string) => void;
};

const themePath = path<StoreState>(p => p.settings.profile.theme);

const useStore = create<StoreState>(set => ({
    settings: { profile: { theme: "light" } },
    setTheme: newTheme => set(state => themePath.set(state, newTheme)),
}));
```

### 4. React `useState`

Update deeply nested state with the functional updater. React requires a new object reference; `path.set()` returns a structural clone so you avoid manual spreading.

```tsx
import { useState } from "react";
import { path } from "data-path";

type AppState = { settings: { profile: { theme: string } } };

const themePath = path<AppState>(p => p.settings.profile.theme);

function ThemeToggle() {
    const [state, setState] = useState<AppState>({
        settings: { profile: { theme: "light" } },
    });

    const setTheme = (theme: string) => {
        setState(prev => themePath.set(prev, theme));
    };

    return <button onClick={() => setTheme("dark")}>{state.settings.profile.theme}</button>;
}
```

### 5. Zod / Validation Mapping

Map Zod validation errors to specific UI fields. Zod's `ZodError` has an `issues` array; each issue has a `path` (e.g. `["user", "age"]`) that you can join to compare with `data-path`.

```typescript
import { z } from "zod";
import { unsafePath, path } from "data-path";

const schema = z.object({
    user: z.object({ age: z.number().min(18) }),
});
type FormData = z.infer<typeof schema>;
const agePath = path<FormData>(p => p.user.age);

const result = schema.safeParse(data);
if (!result.success) {
    for (const issue of result.error.issues) {
        const errorPath = unsafePath<FormData>(issue.path.join("."));
        if (errorPath.equals(agePath)) {
            console.log("Age must be at least 18!");
        }
    }
}
```

### 6. TanStack Table

Define type-safe column accessors. `createColumnHelper.accessor()` accepts an accessor function; use `path.fn` for the extractor and `path.$` for the column `id` (required when using an accessor function).

```typescript
import { createColumnHelper } from "@tanstack/react-table";
import { path } from "data-path";

type User = { id: string; contact: { email: string } };

const columnHelper = createColumnHelper<User>();
const emailPath = path<User>(p => p.contact.email);

const columns = [
    columnHelper.accessor(emailPath.fn, {
        id: emailPath.$,
        header: "Email",
        cell: info => info.getValue(),
    }),
];
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## 📄 License

This project is licensed under the [ISC License](LICENSE).
