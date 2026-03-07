# `data-path` API cheatsheet

## Creation

| API | Description |
|-----|-------------|
| `path<T>()` | Create root path |
| `path<T>(p => p.a.b)` | Create path from lambda, generic type |
| `path((p: T) => p.a.b)` | Create path from lambda, infer type |
| `path(base, p => p.c)` | Extend existing path, `p` must have the output type of `base` |
| `unsafePath<T>("a.b")` | Create path from raw string, not recommended in usual cases |

## Properties

| API | Description |
|-----|-------------|
| `path.$` | String representation (e.g. `"users.0.name"`) |
| `path.segments` | Array of segments |
| `path.length` | Number of segments |
| `path.fn` | Accessor function for `.map()`, `.filter()` |

## Data Access

| API | Description |
|-----|-------------|
| `path.get(data)` | Read value at path (returns `undefined` if missing) |
| `path.set(data, value)` | Immutable write, returns new object |

## Traversal

| API | Description |
|-----|-------------|
| `path.to(p => p.x)` | Extend path from current value |
| `path.each(p => p.x)` | Template: match all items in collection |
| `path.each().to(p => p.x)` | Same as above |
| `path.deep(node => node.id)` | Template: match property at any depth |

## Manipulation

| API | Description |
|-----|-------------|
| `path.merge(other)` | Append path (deduplicates overlap) |
| `path.subtract(other)` | Remove prefix/suffix, or `null` |
| `path.slice(start?, end?)` | Slice segments (like `Array.prototype.slice`) |

## Relational

| API | Description |
|-----|-------------|
| `path.startsWith(other)` | True if path is prefix |
| `path.includes(other)` | True if path contains other |
| `path.equals(other)` | True if paths are identical |
| `path.match(other)` | Returns `{ relation, params }` or `null` |

## Template-only

| API | Description |
|-----|-------------|
| `templatePath.expand(data)` | Resolve template to concrete paths |

## Match Relations

`path.match(other)` returns `MatchResult` with `relation` one of:
- `'includes'` — this path contains other
- `'included-by'` — other contains this path
- `'equals'` — paths are identical
- `'parent'` — this path is parent of other
- `'child'` — this path is child of other
- `null` — no relation
