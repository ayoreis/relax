import { assertEquals } from './_dependencies.ts'
import { compileMustaches } from '../components/_mustache-compiler.ts'

Deno.test('Mustache compiler', () => {
	assertEquals(
		compileMustaches('{"Hello world"}'),
		'${"Hello world"}',
	)
	assertEquals(
		compileMustaches('{123}{456}'),
		'${123}${456}',
	)

	assertEquals(
		compileMustaches(
			'{import.meta}👨‍👩‍👧‍👦{<br/>}{1}{2}{3}xyz{abc}',
		),
		'${import.meta}👨‍👩‍👧‍👦${<br/>}${1}${2}${3}xyz${abc}',
	)
})
