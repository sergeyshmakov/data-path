import { highlight } from "fumadocs-core/highlight";
import { Card, Cards } from "fumadocs-ui/components/card";
import { CodeBlock } from "fumadocs-ui/components/codeblock";
import type { Metadata } from "next";
import Link from "next/link";
import { npmUrl, repositoryUrl, siteDescription } from "@/lib/site";

const beforeCode = `// String literals, invisible to the compiler
register("users.0.profile.firstName");
table.getColumn("contact.email");`;

const afterCode = `// Typed, autocompleted, refactor-safe
register(path((u: FormData) => u.users[0].profile.firstName).$);
table.getColumn(emailPath.$);`;

export const metadata: Metadata = {
	title: "data-path",
	description: siteDescription,
	alternates: {
		canonical: "/",
	},
};

export default async function HomePage() {
	const [beforeHighlighted, afterHighlighted] = await Promise.all([
		highlight(beforeCode, { lang: "ts" }),
		highlight(afterCode, { lang: "ts" }),
	]);

	return (
		<main className="relative flex flex-1 flex-col overflow-hidden">
			<div
				aria-hidden
				className="dp-hero-grid pointer-events-none absolute inset-0 opacity-70"
			/>
			<section className="relative mx-auto w-full max-w-6xl px-6 py-20 sm:py-28">
				<div className="grid items-center gap-12 lg:grid-cols-[minmax(0,12fr)_minmax(0,8fr)]">
					<div>
						<h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
							Typed Object Paths for TypeScript
						</h1>
						<p className="mt-6 max-w-3xl text-pretty text-lg leading-8 text-fd-muted-foreground sm:text-xl">
							Build paths from lambdas. Use them as strings, accessors, or
							composable algebra.
						</p>
						<div className="mt-9 flex flex-wrap gap-3">
							<Link
								href="/getting-started/quick-start/"
								className="rounded-lg bg-fd-primary px-5 py-3 font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
							>
								Quick Start
							</Link>
							<a
								href={repositoryUrl}
								rel="noreferrer noopener"
								target="_blank"
								className="rounded-lg border bg-fd-background px-5 py-3 font-medium transition-colors hover:bg-fd-accent"
							>
								View on GitHub
							</a>
							<a
								href={npmUrl}
								rel="noreferrer noopener"
								target="_blank"
								className="rounded-lg border bg-fd-background px-5 py-3 font-medium transition-colors hover:bg-fd-accent"
							>
								View on npm
							</a>
						</div>
					</div>
					{/* The logo's grammar at hero scale: an indent cascade, one selected
					    key per level, resolving to the accent bar. Opacity carries the
					    depth, so it needs no dark-mode variant. */}
					<img
						src="/hero.svg"
						alt="An indent cascade: at each level one bar is selected and the next level is indented beneath it, resolving to a highlighted bar"
						width={440}
						height={440}
						loading="eager"
						decoding="async"
						className="mx-auto hidden h-auto w-full max-w-sm lg:block"
					/>
				</div>

				<div className="mt-16 grid items-start gap-5 lg:grid-cols-2">
					<CodeBlock
						title="Before — strings the compiler cannot see"
						className="my-0"
					>
						{beforeHighlighted}
					</CodeBlock>
					<CodeBlock title="After — typed, refactor-safe" className="my-0">
						{afterHighlighted}
					</CodeBlock>
				</div>

				<section className="mt-16">
					<h2 className="text-3xl font-semibold tracking-tight">What it is</h2>
					<p className="mt-4 max-w-4xl leading-7 text-fd-muted-foreground">
						A zero-dependency TypeScript library that captures object property
						paths via proxy-based lambdas. Build a path once — use it as a
						string, read and write data through it, compose paths together, or
						match one against another.
					</p>
					<ul className="mt-5 max-w-4xl list-disc space-y-2 pl-6 leading-7 text-fd-muted-foreground">
						<li>
							Typed root to leaf — renaming a property breaks the path at
							compile time
						</li>
						<li>Safe reads, immutable writes, structural clones</li>
						<li>
							Template paths for bulk operations across collections and trees
						</li>
						<li>Path algebra and relational queries</li>
					</ul>
				</section>

				<section className="mt-16">
					<h2 className="text-3xl font-semibold tracking-tight">
						Feature areas
					</h2>
					<Cards className="mt-6">
						<Card
							title="Data access"
							description="get, set, update, and fn — read and write through a typed path."
							href="/guides/data-access/"
						/>
						<Card
							title="Templates"
							description="each and deep for bulk reads and writes across arrays and recursive trees."
							href="/guides/templates/"
						/>
						<Card
							title="Path algebra"
							description="merge, subtract, slice, to — compose and decompose paths."
							href="/guides/path-algebra/"
						/>
						<Card
							title="Integrations"
							description="Works with React Hook Form, Zustand, TanStack, Zod, and more."
							href="/integrations/react-hook-form/"
						/>
					</Cards>
				</section>

				<section className="mt-16">
					<h2 className="text-3xl font-semibold tracking-tight">Next steps</h2>
					<Cards className="mt-6">
						<Card
							title="Install"
							description="Add the package and verify the setup."
							href="/getting-started/installation/"
						/>
						<Card
							title="Quick start"
							description="A working example in under five minutes."
							href="/getting-started/quick-start/"
						/>
						<Card
							title="API cheatsheet"
							description="Every method at a glance."
							href="/reference/api-cheatsheet/"
						/>
						<Card
							title="Types reference"
							description="Path, TemplatePath, ResolvedType, and more."
							href="/reference/types/"
						/>
					</Cards>
				</section>
			</section>
		</main>
	);
}
