import { compile } from '../components/compiler.ts'

Deno.test('Components compiler', () => {
	console.log(compile(
		`~~~ relax   
let ipsum = "ipsum"
~~~

Lorem {ipsum}.`,
		new URL('https://ayoreis.com'),
	))
})
