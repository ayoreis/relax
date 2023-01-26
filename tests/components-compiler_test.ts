import { compile } from '../components/compiler.ts'

Deno.test('Components compiler', () => {
	compile(
		`~~~ relax   
let ipsum = "ipsum"
~~~

Lorem {ipsum}.`,
		new URL('https://ayoreis.com'),
	)
})
