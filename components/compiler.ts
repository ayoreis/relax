import { compileMustaches } from './_mustache-compiler.ts'
import { parse, print } from './_typescript-parser.ts'

type Indentation = '' | ' '

interface CodeFenceMatchGroups {
	content: string
	indentation: `${Indentation}${Indentation}${Indentation}`
	infoString: string
	quantity: number
	type: '`' | '~'
}

/** https://spec.commonmark.org/0.30/#fenced-code-blocks */
const FENCED_CODE_BLOCK =
	/(?<=^|(?:\n|(?:\r\n?)))(?<indentation> {0,3})(?<quantity>(?<type>[`~])\k<type>{2,})[ \t]*(?<infoString>(?!\k<type>)(?:.*?))[ \t]*(?:\n|(?:\r\n?))(?<content>.*?(?:\n|(?:\r\n?)))?(?:\k<quantity>\k<type>*[ \t]*(?:\n|(?:\r\n?))|$)/gs

export function compile(source: string, _base: URL) {
	const scripts: string[] = []

	for (
		const match of source.matchAll(FENCED_CODE_BLOCK)
	) {
		const { groups } = match as unknown as {
			groups: CodeFenceMatchGroups
		}

		source = source.replace(match[0], '')

		const content = groups.content.replaceAll(
			new RegExp(
				`^ {0,${groups.indentation.length}}`,
				'gm',
			),
			'',
		)

		const parsed = parse(content)

		scripts.push(print(parsed))
	}

	const result = `export function component() {
    ${scripts.join('')}

	return \`${compileMustaches(source)}\`
}`

	return result
}
