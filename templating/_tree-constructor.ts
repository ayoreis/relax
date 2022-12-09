import { ParseState } from './_parser.ts'
import {
	CharacterToken,
	CommentToken,
	DOCTYPEToken,
	EndOfFileToken,
	StartTagToken,
	Token,
} from './_token.ts'
import { ASCIICaseInsensitive } from './_infra.ts'
import { Tokenizer } from './_tokenizer.ts'

class InsertionLocation {
	where!: InsertPosition
	element!: Node

	constructor(args: InsertionLocation) {
		Object.assign(this, args)
	}
}

const MATHML_INTEGRATION_POINTS = ['mi', 'mo', 'mn', 'ms', 'mtext'] as const
const ASCII_CASE_INSENSITIVE_HTML_MIME_TYPE = ASCIICaseInsensitive('text/html')

/** https://html.spec.whatwg.org/multipage/parsing.html#mathml-text-integration-point */
function isMathMLTextIntegrationPoint(node: Node) {
	if (!(node instanceof Element)) return false
	return MATHML_INTEGRATION_POINTS.includes(
		node.tagName as typeof MATHML_INTEGRATION_POINTS[number],
	)
}

/** https://html.spec.whatwg.org/multipage/parsing.html#html-integration-point */
function isHTMLIntegrationPoint(node: Node, nodesStartTagToken: StartTagToken) {
	if (!(node instanceof Element)) return false

	return (
		(node.tagName === 'annotation-xml' &&
			Array.from(nodesStartTagToken.attributes).some((attribute) =>
				ASCII_CASE_INSENSITIVE_HTML_MIME_TYPE.test(attribute.name),
			)) ||
		0
	)
}

/** https://html.spec.whatwg.org/multipage/parsing.html#tree-construction */
export class TreeConstructor {
	#document: Document
	#parseState: ParseState

	constructor(parseState: ParseState) {
		this.#document = document.implementation.createHTMLDocument()
		this.#parseState = parseState
	}

	fosterParenting = false

	/** https://html.spec.whatwg.org/multipage/parsing.html#appropriate-place-for-inserting-a-node */
	findAppropriatePlaceForInsertionNode(overrideTarget?: any) {
		const target = overrideTarget ?? this.#parseState.currentNode

		if (
			this.fosterParenting &&
			(target.tagName === 'table' ||
				target.tagName === 'tbody' ||
				target.tagName === 'tfoot' ||
				target.tagName === 'thead' ||
				target.tagName === 'tr')
		) {
			const lastTemplateIndex =
				this.#parseState.stackOfOpenElements.findIndex(
					(element) => element.tagName === 'template',
				)

			const lastTemplate =
				this.#parseState.stackOfOpenElements[lastTemplateIndex]

			const lastTableIndex =
				this.#parseState.stackOfOpenElements.findIndex(
					(element) => element.tagName === 'template',
				)

			const lastTable =
				this.#parseState.stackOfOpenElements[lastTableIndex]

			if (
				lastTemplate &&
				(!lastTable || lastTemplateIndex < lastTableIndex)
			) {
				return new InsertionLocation({
					where: 'afterend',
					element: lastTemplate.contents,
				})
			}

			if (!lastTable) {
				return new InsertionLocation({
					where: 'afterend',
					element: this.#parseState.stackOfOpenElements.at(-1)!,
				})
			}

			if (lastTable.parentNode) {
				return new InsertionLocation({
					where: 'afterend', // TODO imidiatly before last table // before begiunning
					element: lastTable.parentNode, // lasttable?
				})
			}

			const previousElement =
				this.#parseState.stackOfOpenElements[lastTableIndex - 1] // TODO above?

			return new InsertionLocation({
				where: 'inside previous element',
				element: 0, // after its last child (if any).
			})
		} else {
			// Let adjusted insertion location be inside target, after its last child (if any).
		}

		// If the adjusted insertion location is inside a template element, let it instead be inside the template element's template contents, after its last child (if any).
		// Return the adjusted insertion location.
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#insert-a-comment */
	insertComment(
		commentTokenBeingProcessed: CommentToken,
		position?: InsertionLocation,
	) {
		const { data } = commentTokenBeingProcessed
		const comment = document.createComment(data)

		const adjustedInsertionLocation =
			position ?? this.findAppropriatePlaceForInsertionNode()

		adjustedInsertionLocation?.element.in
	}

	// https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inhtml
	/** https://html.spec.whatwg.org/multipage/parsing.html#the-initial-insertion-mode */
	#initialInsertionMode() {
		// TODO document.parserCannotChageModeFlag = false

		const token: any = 0
		if (
			token instanceof CharacterToken &&
			(token.data =
				'\t' ||
				token.data === '\n' ||
				token.data === '\f' ||
				token.data === '\r' ||
				token.data === ' ')
			// deno-lint-ignore no-empty
		) {
		} else if (token instanceof CommentToken) {
			this.insertComment()
		} else if (token instanceof DOCTYPEToken) {
			if (
				token.name !== 'html' ||
				token.publicIdentifier ||
				(typeof token.publicIdentifier !== 'undefined' &&
					token.publicIdentifier === 'about:legacy-compat')
				// deno-lint-ignore no-empty
			) {
			}

			this.#document.append(
				document.implementation.createDocumentType(
					token.name ?? '',
					token.publicIdentifier ?? '',
					token.systemIdentifier ?? '',
				),
			)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#tree-construction-dispatcher */
	#dispatch(token: Token) {
		if (
			this.#parseState.stackOfOpenElements.length === 0 ||
			this.#parseState.adjustedCurrentNode?.namespaceURI ===
				'http://www.w3.org/1999/xhtml' ||
			(isMathMLTextIntegrationPoint(
				this.#parseState.adjustedCurrentNode,
			) &&
				token instanceof StartTagToken &&
				!(['mglyph', 'malignmark'] as const).includes(
					token.tagName!,
				)) ||
			(isMathMLTextIntegrationPoint(
				this.#parseState.adjustedCurrentNode,
			) &&
				token instanceof CharacterToken) ||
			(this.#parseState.adjustedCurrentNode?.tagName &&
				token instanceof StartTagToken &&
				token.tagName === 'svg') ||
			(isHTMLIntegrationPoint(this.#parseState.adjustedCurrentNode) &&
				token instanceof StartTagToken) ||
			(isHTMLIntegrationPoint(this.#parseState.adjustedCurrentNode) &&
				token instanceof CharacterToken) ||
			token instanceof EndOfFileToken
		) {
			insertionMode()
		} else {
			// TODO
		}
	}

	*constructTree(): Generator<undefined, Document, Token> {
		const token = yield

		this.#dispatch(token)

		return this.#document
	}
}
