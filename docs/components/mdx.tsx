import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { BlogFaq, BlogFaqItem } from "@/components/mdx/blog-faq";

export function getMDXComponents(components?: MDXComponents) {
	return {
		...defaultMdxComponents,
		BlogFaq,
		BlogFaqItem,
		...components,
	} satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
	type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
