import { assertEquals } from 'https://deno.land/std@0.195.0/assert/mod.ts';

import { Router } from './router.ts';

Deno.test('Router', async (tasks) => {
	let router: Router;

	await tasks.step('Create router', () => {
		router = new Router();
	});

	await tasks.step('Add middleware', () => {
		router.any('*', function* () {
			console.time();
			yield;
			console.timeEnd();
		});
	});

	await tasks.step('Add handlers', () => {
		router.get('/', () => {
			return new Response('Hello world');
		});

		router.get('/:id', (_request, groups) => {
			return new Response(`Hello ${groups.id}`);
		});
	});

	await tasks.step('Static route', async () => {
		const response = await router.handler(
			new Request('https://example.com'),
		);

		assertEquals(await response.text(), 'Hello world');
	});

	await tasks.step('Dynamic route', async () => {
		const response = await router.handler(
			new Request('https://example.com/123'),
		);

		assertEquals(await response.text(), 'Hello 123');
	});
});
