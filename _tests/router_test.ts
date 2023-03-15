import { assertEquals } from 'https://deno.land/std@0.179.0/testing/asserts.ts';

import { Router } from '../routing/router.ts';

const router = new Router();

Deno.test('Router', async (testContext) => {
	await testContext.step('Add route', () => {
		router.add('GET', '/', () => {
			return new Response('Hello world!');
		});
	});

	await testContext.step('Handle', async () => {
		const request = new Request(
			new URL('http://localhost'),
		);

		assertEquals(
			await (await router.handle(request))?.text(),
			'Hello world!',
		);
	});

	await testContext.step('Add async route', () => {
		// deno-lint-ignore require-await
		router.add('GET', '/async', async () => {
			return new Response('Hello async!');
		});
	});

	await testContext.step('Handle async', async () => {
		const request = new Request(
			new URL('http://localhost/async'),
		);

		assertEquals(
			await (await router.handle(request))?.text(),
			'Hello async!',
		);
	});

	await testContext.step('Add dynamic route', () => {
		router.add(
			'GET',
			'/dynamic/:id',
			(_request, { id }) => {
				return new Response(
					`Dynamic #${id}`,
				);
			},
		);
	});

	await testContext.step('Handle dynamic', async () => {
		const id = Math.random();

		const request = new Request(
			new URL(`http://localhost/dynamic/${id}`),
		);

		assertEquals(
			await (await router.handle(request))?.text(),
			`Dynamic #${id}`,
		);
	});
});
