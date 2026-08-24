import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { npmUrl, repositoryUrl, siteName } from "@/lib/site";

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			title: (
				<span className="flex items-center gap-2">
					<img src="/logo.svg" alt="" width={24} height={24} />
					<span>{siteName}</span>
				</span>
			),
		},
		githubUrl: repositoryUrl,
		// The Blog link is deliberately absent: the routes exist but no post has
		// been written yet, so advertising an empty index would be worse than
		// leaving it undiscoverable. Add it back with the first post.
		links: [
			{
				text: "Documentation",
				url: "/getting-started/installation/",
				active: "nested-url",
			},
			{
				text: "npm",
				url: npmUrl,
				external: true,
			},
		],
	};
}
