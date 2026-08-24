// Asserts the exported site actually contains every public route, that each one
// declares the canonical URL it should, and that titles match where they are
// pinned. This is what makes the Astro -> Fumadocs URL-parity claim testable:
// the list below is the old Starlight route set, unchanged.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const SITE = "https://path.shmakov.tools";

const routes = [
	"/",
	"/blog/",
	"/blog/authors/sergei-shmakov/",
	"/getting-started/installation/",
	"/getting-started/quick-start/",
	"/guides/data-access/",
	"/guides/path-algebra/",
	"/guides/relational/",
	"/guides/runtime-variables/",
	"/guides/templates/",
	"/integrations/react-hook-form/",
	"/integrations/react-usestate/",
	"/integrations/tanstack-form/",
	"/integrations/tanstack-table/",
	"/integrations/zod/",
	"/integrations/zustand/",
	"/reference/api-cheatsheet/",
	"/reference/types/",
];

const exactTitles = new Map([
	["/", "data-path | data-path"],
	["/blog/", "Blog | data-path"],
	["/blog/authors/sergei-shmakov/", "Sergei Shmakov | data-path"],
	["/getting-started/installation/", "Installation | data-path"],
	["/getting-started/quick-start/", "Quick Start | data-path"],
	["/reference/api-cheatsheet/", "API cheatsheet | data-path"],
	["/reference/types/", "Types | data-path"],
]);

const exactHeadings = new Map([
	["/", "Typed Object Paths for TypeScript"],
	["/blog/", "Blog"],
]);

function fileForRoute(route) {
	if (route === "/") return path.join("out", "index.html");
	return path.join("out", ...route.split("/").filter(Boolean), "index.html");
}

function match(html, expression, label, route) {
	const result = expression.exec(html)?.[1];
	if (!result) throw new Error(`${route}: missing ${label}`);
	return result;
}

for (const route of routes) {
	const file = fileForRoute(route);
	if (!existsSync(file)) throw new Error(`${route}: expected ${file}`);
	const html = await readFile(file, "utf8");
	const canonical = match(
		html,
		/<link rel="canonical" href="([^"]+)"/,
		"canonical URL",
		route,
	);
	if (canonical !== `${SITE}${route}`) {
		throw new Error(`${route}: canonical is ${canonical}`);
	}
	match(
		html,
		/<meta name="description" content="([^"]+)"/,
		"description",
		route,
	);

	const expectedTitle = exactTitles.get(route);
	if (expectedTitle) {
		const title = match(html, /<title>(.*?)<\/title>/, "title", route);
		if (title !== expectedTitle) {
			throw new Error(`${route}: title is ${title}; expected ${expectedTitle}`);
		}
	}

	const expectedHeading = exactHeadings.get(route);
	if (expectedHeading) {
		const heading = match(html, /<h1[^>]*>(.*?)<\/h1>/, "H1", route);
		if (heading !== expectedHeading) {
			throw new Error(
				`${route}: H1 is ${heading}; expected ${expectedHeading}`,
			);
		}
	}
}

// The social card is referenced by every page's metadata, so a missing render
// would otherwise only surface as a broken share preview in production.
for (const asset of [
	"favicon.svg",
	"logo.svg",
	"hero.svg",
	"og-default.png",
	"robots.txt",
	"sitemap.xml",
]) {
	const file = path.join("out", asset);
	if (!existsSync(file)) throw new Error(`missing exported asset: ${file}`);
}

console.log(`validated ${routes.length} routes against ${SITE}`);
