# Pending blog routes

These two routes are complete and ready, but they are parked in a Next
[private folder](https://nextjs.org/docs/app/getting-started/project-structure#private-folders)
(the leading `_`), which excludes the whole subtree from routing.

**Why:** with `output: "export"`, Next 16 fails the build outright when a dynamic
route's `generateStaticParams()` returns an empty array. Both of these derive
their params from blog posts — `blog.getPages()` for `[slug]`, post frontmatter
for `tags/[tag]` — and there are no posts yet, so neither can generate a single
route. `/blog/`, `/blog/authors/[author]/` and `/blog/rss.xml` are unaffected:
the author list comes from a static map in `lib/blog.ts`, not from posts.

**To activate,** once the first post exists in `content/blog/`:

```sh
git mv "app/(home)/blog/_pending/[slug]"    "app/(home)/blog/[slug]"
git mv "app/(home)/blog/_pending/tags"      "app/(home)/blog/tags"
git rm  "app/(home)/blog/_pending/README.md"
```

Then re-add the `Blog` nav entry in `lib/layout.shared.tsx`, and add the new
routes to `scripts/validate-links.mjs` (`pages` + `populate`) and the `routes`
list in `scripts/validate-routes.mjs`.
