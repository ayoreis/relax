import { parse } from './dependencies.ts';

const FRONTMATTER =
	/^(?:[ \t\n\f\r]*(?:\n|\r\n?))?(?<indentation> {0,3})(?<quantity>(?<type>-)\k<type>{2,})[ \t]*(?<infoString>[^`\n]*?)?[ \t]*(?:\n|\r\n?)(?<content>[^]*?)(?:(?:\n|\r\n?)\k<quantity>\k<type>*(?:\n|\r\n?|$)|$)/d;

const MUSTACHE =
	/(?<!\\)(?:\\{2})*\{\s*(?<key>[0-9]|[1-9][0-9]*|[A-Za-z$_][\w$]*)\s*\}/g;

export function compile(source: string, _filepath: URL) {
	const match = source.match(FRONTMATTER);

	if (match === null) {
		return source;
	}

	const { indentation, content } = match.groups!;

	const indentationRegEx = new RegExp(`^ {${indentation}}`, 'gm');
	const frontmatter = content.replaceAll(indentationRegEx, '');

	let parsedFrontmatter: object;

	try {
		parsedFrontmatter = parse(frontmatter)!;
	} catch (error) {
		if (error.name !== 'YAMLError') throw error;

		throw SyntaxError('Invalid YAML in frontmatter');
	}

	const markdown = source.slice(match.indices![0][1]).replaceAll(
		MUSTACHE,
		(_, key: string) =>
			String((parsedFrontmatter as Record<string, unknown>)[key]),
	);

	return markdown;
}

console.log(compile(
	`-- - l
title: Hello world!
---w
# {title}`,
	new URL(import.meta.url),
));
