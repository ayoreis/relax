import { SWCTypes } from './_dependencies.ts'
import { getAccumulatedSpan, parse } from './_estree.ts'

export function compileMustaches(HTML: string) {
	for (let index = 0; index < HTML.length; ) {
		const nextOpeningBracketIndex = HTML.indexOf('{', index - 1)

		if (nextOpeningBracketIndex === -1) break

		const string = `\`$${HTML.slice(nextOpeningBracketIndex)}\``
		const accumulatedSpan = getAccumulatedSpan()
		const AST = parse(string)

		const [expression] = (
			(AST.body[0] as SWCTypes.ExpressionStatement)
				.expression as SWCTypes.TemplateLiteral
		).expressions

		// @ts-ignore `MetaProperty` does have a `span`
		const end = expression.span.end - accumulatedSpan

		HTML = `${HTML.slice(0, nextOpeningBracketIndex)}$${HTML.slice(
			nextOpeningBracketIndex,
		)}`

		index = nextOpeningBracketIndex + (end - 1)
	}

	return HTML
}
