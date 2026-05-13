import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

const REPO_URL = "https://github.com/sergeyshmakov/data-path";

export default defineConfig({
	site: "https://sergeyshmakov.github.io/data-path",
	base: "/data-path",
	integrations: [
		starlight({
			title: "data-path",
			description:
				"Type-safe object path builder, accessor, and algebra for TypeScript.",
			customCss: ["./src/styles/custom.css"],
			social: [{ icon: "github", label: "GitHub", href: REPO_URL }],
			editLink: {
				baseUrl: `${REPO_URL}/edit/main/docs/`,
			},
			lastUpdated: true,
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
			expressiveCode: {
				themes: ["github-dark", "github-light"],
				styleOverrides: { borderRadius: "0.375rem" },
			},
			sidebar: [
				{
					label: "Getting Started",
					items: [
						"getting-started/installation",
						"getting-started/quick-start",
					],
				},
				{
					label: "Guides",
					items: [
						"guides/data-access",
						"guides/templates",
						"guides/path-algebra",
						"guides/relational",
						"guides/runtime-variables",
					],
				},
				{
					label: "Integrations",
					items: [
						"integrations/react-hook-form",
						"integrations/tanstack-form",
						"integrations/tanstack-table",
						"integrations/zustand",
						"integrations/zod",
						"integrations/react-usestate",
					],
				},
				{
					label: "Reference",
					items: ["reference/api-cheatsheet", "reference/types"],
				},
			],
		}),
	],
});
