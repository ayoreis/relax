import { parse, print } from './_dependencies.ts'

type Indentation = '' | ' '

interface CodeFenceMatchGroups {
	content: string
	indentation: `${Indentation}${Indentation}${Indentation}`
	info: string
	quantity: number
	type: '`' | '~'
}

const CODE_FENCE =
	/^(?<indentation> {0,3})(?<quantity>(?<type>[`~])\k<type>{2,})(?<info>((?!`).)*?)\n(?<content>.*?)\n\k<quantity>\k<type>*/gms
const CODE_FENCE_RELAX_INFOS = ['relax-module', 'relax-component']

export function compile(source: string, base: URL) {
	const scripts: string[] = []

	for (const match of source.matchAll(CODE_FENCE)) {
		const { groups } = match as unknown as {
			groups: CodeFenceMatchGroups
		}

		if (!CODE_FENCE_RELAX_INFOS.includes(groups.info.trim())) break

		source = source.replace(match[0], '')

		const content = groups.content.replaceAll(
			new RegExp(`^ {0,${groups.indentation.length}}`, 'gm'),
			'',
		)

		const parsed = parse(content, {
			syntax: 'typescript',
			tsx: true,
			decorators: true,
			dynamicImport: true,
			comments: true,
			script: false,
			target: 'es2022',
		})

		scripts.push(print(parsed).code)
	}

	const result = `export function component() {
    ${scripts.join('')}
}`

	return result
}

if (import.meta.main) {
	console.log(
		compile(
			`~~~ relax-component   
let a = 0
~~~

Lorem ipsum.`,
			new URL('https://ayoreis.com'),
		),
	)
}
