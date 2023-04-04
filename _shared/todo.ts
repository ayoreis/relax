import { red } from './dependencies.ts';

export function todo(message?: string) {
	console.error(red(message ?? 'Todo'));
}
