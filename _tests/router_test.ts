import { assertEquals } from 'https://deno.land/std@0.179.0/testing/asserts.ts';

import { Router } from '../routing/router.ts';

const router = new Router();
const response = new Response('Hello, world');
const request = new Request(new URL('http://localhost'));
const asyncRequest = new Request(
	new URL('http://localhost/async'),
);

Deno.test('Router', async (testContext) => {
	await testContext.step('Add route', () => {
		router.add('GET', '/', () => {
			return response;
		});
	});

	await testContext.step('Handle', async () => {
		assertEquals(await router.handle(request), response);
	});

	await testContext.step('Add async route', () => {
		// deno-lint-ignore require-await
		router.add('GET', '/async', async () => {
			return response;
		});
	});

	await testContext.step('Handle async', async () => {
		assertEquals(
			await router.handle(asyncRequest),
			response,
		);
	});
});
