import { assertEquals } from './_dependencies.ts'
import { Router } from '../router/router.ts'

const router = new Router()

Deno.test('Router', async () => {
	router.get('/', () => {
		return new Response('Hello world!')
	})

	router.get('/about', () => {
		return new Response('About')
	})

	router.get('/:id', (_, { id }) => {
		return new Response(`Post #${id}`)
	})

	assertEquals(
		await (await router.fetch(
			new Request('https://example.com'),
		))!.text(),
		'Hello world!',
	)

	assertEquals(
		await (await router.fetch(
			new Request('https://example.com/about'),
		))!.text(),
		'About',
	)

	assertEquals(
		await (await router.fetch(
			new Request('https://example.com/123'),
		))!.text(),
		'Post #123',
	)
})
