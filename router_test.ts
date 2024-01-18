import { assertEquals } from 'https://deno.land/std@0.212.0/assert/mod.ts'

import { Router } from './router.ts'

const HOME_RESPONSE_TEXT = 'Home'
const NOW_RESPONSE_TEXT = 'Now'
const $404_RESPONSE_TEXT = '404'

Deno.test('Router', async (test_context) => {
	const router = new Router()

	await test_context.step('Add routes', () => {
		router.get('/', () => new Response(HOME_RESPONSE_TEXT))
		router.get('/now', () => new Response(NOW_RESPONSE_TEXT))
		router.$404(() => new Response($404_RESPONSE_TEXT))
	})

	await test_context.step('Get routes', async () => {
		const home_response_text =
			await (await router.handle(new Request('https://example.com')))
				.text()

		assertEquals(home_response_text, HOME_RESPONSE_TEXT)

		const now_response_text =
			await (await router.handle(new Request('https://example.com/now')))
				.text()

		assertEquals(now_response_text, NOW_RESPONSE_TEXT)
	})

	await test_context.step('404 route', async () => {
		const response_text =
			await (await router.handle(new Request('https://example.com/404')))
				.text()

		assertEquals(response_text, $404_RESPONSE_TEXT)
	})
})
