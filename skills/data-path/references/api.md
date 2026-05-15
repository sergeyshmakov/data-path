# `data-path` API cheatsheet

## Creation

| API | Description |
|-----|-------------|
| `path<T>()` | Create root path (no segments) |
| `path((p: T) => p.a.b)` | Create path from lambda; type inferred from parameter annotation |
| `path<T, V>(p => p.a.b)` | Create path from lambda; generics explicit |
| `path(base, p => p.c)` | Extend existing path; `p` is typed as the output type of `base` |
| `unsafePath<T>("a.b")` | Create path from raw dot-separated string |

## Properties

| API | Description |
|-----|-------------|
| `path.$` | Dot-notation string (e.g. `"users.0.name"`) |
| `path.segments` | Array of string/number segments |
| `path.length` | Number of segments |
| `path.fn` | Pre-bound accessor — useful with `.map()`, `.filter()` |

## Data Access

| API | Description |
|-----|-------------|
| `path.get(data)` | Read value; returns `undefined` if any segment is missing |
| `path.set(data, value)` | Immutable write; returns a new structurally-cloned object |
| `path.update(data, fn)` | Read-modify-write: `fn` receives current value, returns new value |

## Navigation

| API | Description |
|-----|-------------|
| `path.parent()` | Returns path without the last segment, or `null` for root/empty. On a `TemplatePath`, the return widens to `Path \| TemplatePath \| null` so wildcards are preserved when they remain in the parent. |
| `path.to(relative)` | Extend this path with a relative path rooted at `V`. Returns `Path<T, U> \| TemplatePath<T, U>` — a `TemplatePath` when `relative` carries `*`/`**`, otherwise a `Path`. |

`path.to()` accepts a `ResolvablePath<V, U>`: a lambda `(v: V) => U`, a pre-built `Path<V, U>` or `TemplatePath<V, U>`, or a `{segments}` object.

## Traversal (non-primitive `V` only)

`.each()` and `.deep()` are only available when `V` is not a primitive type.

| API | Description |
|-----|-------------|
| `path.each(p => p.x)` | Template: match all items in collection, traverse to `x` (`*` wildcard) |
| `path.each()` | Template: match all items in collection |
| `path.deep(node => node.id)` | Template: match property at any nesting depth (`**` wildcard) |
| `path.deep()` | Template: every descendant node |

## Manipulation

| API | Description |
|-----|-------------|
| `path.merge(other)` | Append path with smart overlap deduplication. Returns `Path<T, U> \| TemplatePath<T, U>` — a `TemplatePath` when `other` carries `*`/`**`. |
| `path.subtract(other)` | Remove prefix; returns remaining tail as `Path<U, V>`, or `null`. On a `TemplatePath`, return widens to `Path<U, V> \| TemplatePath<U, V> \| null`. |
| `path.slice(start?, end?)` | Slice segments (`Array.prototype.slice` semantics). On a `TemplatePath`, return widens to `Path<T, unknown> \| TemplatePath<T, unknown>`. |

All manipulation methods accept a `ResolvablePath`: lambda, pre-built `Path`/`TemplatePath`, or `{segments}` object.

## Relational

| API | Description |
|-----|-------------|
| `path.startsWith(other)` | `true` if `other` is a prefix of this path |
| `path.covers(other)` | `true` if this path is a prefix of `other` (this location covers `other` in the data tree) |
| `path.equals(other)` | `true` if paths are segment-by-segment identical |
| `path.match(other)` | Returns `MatchResult` or `null` when unrelated |

All relational methods accept a `ResolvablePath`.

## Template-only

`TemplatePath` overrides several methods to operate across all wildcard matches:

| API | Description |
|-----|-------------|
| `templatePath.get(data)` | Returns `V[]` — all matched values (not `V \| undefined`) |
| `templatePath.fn` | Pre-bound accessor returning `V[]` |
| `templatePath.expand(data)` | Resolve template to concrete `Path<T, V>[]` |
| `templatePath.to(relative)` | Extend template; returns `TemplatePath<T, U>` (always — `this` carries wildcards) |
| `templatePath.merge(other)` | Append with overlap deduplication; returns `TemplatePath<T, U>` |
| `templatePath.subtract(prefix)` | Remove prefix; returns `Path<U, V> \| TemplatePath<U, V> \| null` — `TemplatePath` if wildcards remain in the tail |
| `templatePath.parent()` | Returns `Path<T, unknown> \| TemplatePath<T, unknown> \| null` |
| `templatePath.slice(start?, end?)` | Returns `Path<T, unknown> \| TemplatePath<T, unknown>` |

## Match Relations

`path.match(other)` returns `MatchResult` with `relation` one of:
- `'covers'` — this path is a prefix of `other` (this path's location covers `other`)
- `'covered-by'` — `other` is a prefix of this path
- `'equals'` — paths are identical
- `'parent'` — this path is the direct parent of `other`
- `'child'` — this path is a direct child of `other`
- `null` — no relation
