## [2.0.1](https://github.com/sergeyshmakov/data-path/compare/v2.0.0...v2.0.1) (2026-05-15)


### Bug Fixes

* .match() agrees with .covers() for wildcard prefix coverage ([59412f4](https://github.com/sergeyshmakov/data-path/commit/59412f40a99e3a43ac6674cdc1805383f3d2d712))
* matchesPrefix rejects single-segment pattern vs ** in full ([49b53f3](https://github.com/sergeyshmakov/data-path/commit/49b53f3cbc5de4173e053cbd3307245ddcdf5dc1))

# [2.0.0](https://github.com/sergeyshmakov/data-path/compare/v1.0.3...v2.0.0) (2026-05-15)


* refactor!: wildcards are unique Symbols, not the strings '*'/'**' ([db450e1](https://github.com/sergeyshmakov/data-path/commit/db450e141e53c2593d0491d36a0199486923dc8c))


### Bug Fixes

* .match() returns 'covers' (not 'parent') for deep template vs concrete ([99b453e](https://github.com/sergeyshmakov/data-path/commit/99b453e391f924e5631a9649473084cf52b0d07d))
* address code-review findings — runtime, types, docs ([5419b7f](https://github.com/sergeyshmakov/data-path/commit/5419b7fe267c4eaab8ce1cf85bf5274698fdbcab))
* preserve literal '*'/'**' keys in PathImpl.to/merge ([971e81c](https://github.com/sergeyshmakov/data-path/commit/971e81c84b58aed812b8e0f26cc229ebf6217a8d))
* restore node engines >=20 after accidental bump ([34d2959](https://github.com/sergeyshmakov/data-path/commit/34d2959ed1eba020a0173c4da0397335025bf9cf))
* wildcards are unique Symbols, not the strings '*'/'**' ([b5fab74](https://github.com/sergeyshmakov/data-path/commit/b5fab745aeb33b2291790fe970d31d090a78f856))


### Features

* clear separation between path and template path + more test cases ([c28d0c4](https://github.com/sergeyshmakov/data-path/commit/c28d0c4b0be382625a9b4a34699043b16fcf46dc))
* overhaul public API for zero-cast DX and strict TypeScript correctness ([e22e9cf](https://github.com/sergeyshmakov/data-path/commit/e22e9cfd26fe89eb9e4b59721f99532cfaedcc59))


### BREAKING CHANGES

* WILDCARD and DEEP_WILDCARD are now unique Symbol
sentinels. The `Segment` type widens to include them. Legitimate object
keys named "*" or "**" are now preserved as literal string segments and
never reinterpreted as wildcards by any method.

Resolves a class of bugs where the same path object behaved differently
depending on which method was called:

- `unsafePath("a.*.b").get(data)` reads the literal "*" key
  `unsafePath("a.*.b").covers(concrete)` treated "*" as a wildcard
  Same path, two semantics — confirmed by probe pre-refactor.

- `each().to(unsafePath("*"))` reinterpreted the appended literal "*"
  as a wildcard once it landed inside a TemplatePathImpl.

- `concretePath.equals(eachTemplate)` returned true when segments
  matched by string — but the two paths have different `.get()`
  behaviour.

After the refactor:
- `unsafePath("a.*.b")` is fully concrete; "*" is a literal key for all
  methods including `.startsWith`, `.covers`, `.match`.
- `.equals` correctly distinguishes literal "*" from wildcard sentinel.
- The `instanceof TemplatePathImpl` check in PathImpl.to/merge is no
  longer needed — segment content is again sufficient.
- `.toString()` / `.$` still render sentinels as "*"/"**" so dot-notation
  output is unchanged.

Also fixed: `matchesPrefix` now treats `**` as zero-or-more (was
rejecting `a.**.b` against `a.b` due to a length-guard bug).

WILDCARD and DEEP_WILDCARD are now exported for users building
templates from raw segment arrays.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
