const FRONTMATTER =
	/^(?:[ \t\n\f\r]*(?:\n|\r\n?))?(?<indentation> {0,3})(?<quantity>(?<type>-)\k<type>{2,})[ \t]*(?<infoString>[^`\n]*?)?[ \t]*(?:\n|\r\n?)(?<content>[^]*?)(?:(?:\n|\r\n?)\k<quantity>\k<type>*(?:\n|\r\n?|$)|$)/d;

export function compile(source: string) {
	const match = source.match(FRONTMATTER);

	if (match === null) {
		return `export default "${source}"`;
	}

	const frontmatter = match.groups!.content;
	const markdown = source.slice(match.indices![0][1]);

	return `${frontmatter}

export default \`${markdown}\``;
}

if (import.meta.main) {
	const result = compile(`---
const title = "Hello world";
---
\${title}`);

	const blob = new Blob([result], { type: 'text/tsx' });
	const objectUrl = URL.createObjectURL(blob);

	console.log(await import(objectUrl));

	URL.revokeObjectURL(objectUrl);
}
