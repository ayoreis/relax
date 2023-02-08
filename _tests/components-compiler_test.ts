import { compile } from '../components/compiler.ts'

Deno.test('Components compiler', async () => {
	const source = await Deno.readTextFile(
		'_tests/component.relax',
	)

	const compiled = compile(
		source,
		new URL('https://ayoreis.com'),
	)

	await Deno.writeTextFile('_tests/component.js', compiled)
})
