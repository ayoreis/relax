import { assertEquals } from 'https://deno.land/std@0.179.0/testing/asserts.ts';

import { Router } from '../routing/router.ts';

const router = new Router();
const response = new Response('Hello, world');
const request = new Request(new URL('http://localhost'));

Deno.test('Router', async (testContext) => {
	await testContext.step('Add route', () => {
		router.add('GET', '/', () => {
			return response;
		});
	});

	await testContext.step('Handle', () => {
		assertEquals(router.handle(request), response);
	});
});
