import { Parser } from './mod.ts';

Deno.test('Markdown parser', () => {
	console.log(Parser.parse(
		`# Hello, world!

---

Paragraph line 1
Paragraph line 2

Setext heading line 1
Setext heading line 2
---

# ksks`,
	));
});
