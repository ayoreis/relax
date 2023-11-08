import { LINE_ENDING, Parser } from './markdown-parser.ts';

Deno.test('Markdown parser', () => {
	console.log(Parser.parse('# Hello, world!'.split(LINE_ENDING)));
});
