import path from "node:path";
import { getTableOfContents } from "fumadocs-core/content/toc";
import { getSlugs } from "fumadocs-core/source";
import {
	printErrors,
	readFiles,
	scanURLs,
	validateFiles,
} from "next-validate-link";

const docsFiles = await readFiles("content/docs/**/*.{md,mdx}");
// The blog ships before its first post, so this is legitimately empty today.
const blogFiles = await readFiles("content/blog/**/*.{md,mdx}");

const docsEntries = docsFiles.map((file) => ({
	value: getSlugs(
		path.relative("content/docs", file.path).split(path.sep).join("/"),
	),
	hashes: getTableOfContents(file.content).map((item) => item.url.slice(1)),
}));

const scanned = await scanURLs({
	preset: "next",
	// blog/[slug] and blog/tags/[tag] are parked under a private folder until the
	// first post exists — see app/(home)/blog/_pending/README.md — so they are
	// deliberately absent here. Re-add both when those routes go live.
	pages: [
		path.join("(home)", "page.tsx"),
		path.join("(home)", "blog", "page.tsx"),
		path.join("(home)", "blog", "authors", "[author]", "page.tsx"),
		path.join("(docs)", "[...slug]", "page.tsx"),
	],
	populate: {
		"(docs)/[...slug]": docsEntries,
		"(home)/blog/authors/[author]": [{ value: "sergei-shmakov" }],
	},
});

for (const [url, metadata] of scanned.urls) {
	if (url !== "/" && !url.endsWith("/") && !url.includes(".")) {
		scanned.urls.set(`${url}/`, metadata);
	}
}

printErrors(
	await validateFiles([...docsFiles, ...blogFiles], {
		scanned,
	}),
	true,
);
