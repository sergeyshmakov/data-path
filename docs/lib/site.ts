export const siteName = "data-path";
export const siteDescription =
	"Type-safe object path builder, accessor, and algebra for TypeScript.";
export const siteUrl = "https://path.shmakov.tools";
export const repositoryUrl = "https://github.com/sergeyshmakov/data-path";
export const npmUrl = "https://www.npmjs.com/package/data-path";
export const ogImagePath = "/og-default.png";
export const ogImageAlt =
	"data-path — typed object property paths for TypeScript";

export const authorName = "Sergei Shmakov";

export function absoluteUrl(path: string): URL {
	const url = new URL(path, siteUrl);
	if (!url.pathname.endsWith("/") && !url.pathname.includes(".")) {
		url.pathname += "/";
	}
	return url;
}
