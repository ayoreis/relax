import { Tokenizer } from './_tokenizer.ts'
import { TreeConstructor } from './_tree-constructor.ts'

/** https://html.spec.whatwg.org/multipage/parsing.html#the-insertion-mode */
type InsertionMode = () => void

/** https://html.spec.whatwg.org/multipage/parsing.html#stack-of-open-elements */
type StackOfOpenElements = Element[]

/** https://html.spec.whatwg.org/multipage/parsing.html#parse-state */
export class ParseState {
	/** https://html.spec.whatwg.org/multipage/parsing.html#tokenization */
	tokenizer!: Tokenizer
	/** https://html.spec.whatwg.org/multipage/parsing.html#tree-construction */
	treeConstructor!: TreeConstructor
	// https://html.spec.whatwg.org/multipage/parsing.html#the-insertion-mode
	/** https://html.spec.whatwg.org/multipage/parsing.html#insertion-mode */
	insertionMode?: InsertionMode
	/** https://html.spec.whatwg.org/multipage/parsing.html#original-insertion-mode */
	originalInsertionMode?: InsertionMode
	/** https://html.spec.whatwg.org/multipage/parsing.html#stack-of-template-insertion-modes */
	stackOfTemplateInsertionModes: InsertionMode[] = []

	/** https://html.spec.whatwg.org/multipage/parsing.html#current-template-insertion-mode */
	get currentTemplateInsertionMode() {
		return this.stackOfTemplateInsertionModes.at(-1)
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#html-fragment-parsing-algorithm */
	HTMLFragmentParsingAlgorithm = false
	/** https://html.spec.whatwg.org/multipage/parsing.html#concept-frag-parse-context */
	context: Element | null = null

	/** https://html.spec.whatwg.org/multipage/parsing.html#reset-the-insertion-mode-appropriately */
	// resetInsertionModeAppropriately() {
	// 	let last = false
	// 	let node = this.stackOfOpenElements.at(-1)! // TODO

	// 	while (true) {
	// 		if (node === this.stackOfOpenElements[0]) {
	// 			last = true

	// 			if (this.HTMLFragmentParsingAlgorithm) {
	// 				node = this.context!
	// 			}
	// 		}

	// 		if (node.tagName === 'select') {
	// 			if (!last) {
	// 				let ancestorIndex
	// 				let ancestor = node

	// 				while (true) {
	// 					if (ancestor === this.stackOfOpenElements[0]) {
	// 						// TODO
	// 						break
	// 					}

	// 					ancestor =
	// 				}
	// 			}

	// 			// Let ancestor be the node before ancestor in the stack of open elements.

	// 			// If ancestor is a template node, jump to the step below labeled done.

	// 			// If ancestor is a table node, switch the insertion mode to "in select in table" and return.

	// 			// Jump back to the step labeled loop.

	// 			// Done: Switch the insertion mode to "in select" and return.

	// 			this.insertionMode = this.treeConstructor.inSelectInsertionMode
	// 		}
	// 	}
	// }

	// https://html.spec.whatwg.org/multipage/parsing.html#the-stack-of-open-elements
	/** https://html.spec.whatwg.org/multipage/parsing.html#stack-of-open-elements */
	stackOfOpenElements: StackOfOpenElements = []

	constructor(args?: Partial<ParseState>) {
		Object.assign(this, args)
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#current-node */
	get currentNode() {
		return this.stackOfOpenElements[0]
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#adjusted-current-node */
	get adjustedCurrentNode() {
		// TODO
		return this.HTMLFragmentParsingAlgorithm &&
			this.stackOfOpenElements.length === 1
			? this.context
			: this.currentNode
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#special */
	isSpecial(element: Element) {
		return [
			'address',
			'applet',
			'area',
			'article',
			'aside',
			'base',
			'basefont',
			'bgsound',
			'blockquote',
			'body',
			'br',
			'button',
			'caption',
			'center',
			'col',
			'colgroup',
			'dd',
			'details',
			'dir',
			'div',
			'dl',
			'dt',
			'embed',
			'fieldset',
			'figcaption',
			'figure',
			'footer',
			'form',
			'frame',
			'frameset',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'head',
			'header',
			'hgroup',
			'hr',
			'html',
			'iframe',
			'img',
			'input',
			'keygen',
			'li',
			'link',
			'listing',
			'main',
			'marquee',
			'menu',
			'meta',
			'nav',
			'noembed',
			'noframes',
			'noscript',
			'object',
			'ol',
			'p',
			'param',
			'plaintext',
			'pre',
			'script',
			'section',
			'select',
			'source',
			'style',
			'summary',
			'table',
			'tbody',
			'td',
			'template',
			'textarea',
			'tfoot',
			'th',
			'thead',
			'title',
			'tr',
			'track',
			'ul',
			'wbr',
			'xmp',
			'mi',
			'mo',
			'mn',
			'ms',
			'mtext',
			'annotation-xml',
			'foreignObject',
			'desc',
		].includes(element.tagName)
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#formatting */
	isFormatting(element: Element) {
		return [
			'a',
			'b',
			'big',
			'code',
			'em',
			'font',
			'i',
			'nobr',
			's',
			'small',
			'strike',
			'strong',
			'tt',
			'u',
		].includes(element.tagName)
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#ordinary */
	isOrdinary(element: Element) {
		return !this.isSpecial(element) && !this.isFormatting(element)
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#has-an-element-in-the-specific-scope */
	hasElementInSpecificScope(target: Node, list: string[]) {
		let node = this.currentNode

		if (node === target) return true
		if (list.includes(node.tagName)) return false
	}
}

/** https://html.spec.whatwg.org/multipage/parsing.html#html-parser */
export function parseHTML(input: string) {
	const parseState = new ParseState()

	const tokenizer = new Tokenizer(input)
	const treeConstructor = new TreeConstructor(parseState)

	const tokenizerGenerator = tokenizer.tokenize()
	const treeConstructorGenerator = treeConstructor.constructTree()

	for (const token of tokenizerGenerator) {
		treeConstructorGenerator.next(token)
	}
}

/** https://html.spec.whatwg.org/multipage/parsing.html#html-fragment-parsing-algorithm */
export function parseHTMLFragment(context: Element, input: string) {
	const theDocument = document.implementation.createHTMLDocument()

	if (context.ownerDocument.compatMode === 'BackCompat') {
		document
	}
}

router.get('/redirect-me', () => {
	return Response.redirect('/pdf', 301)
})
