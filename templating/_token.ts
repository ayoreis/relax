// TODO Narrow this
// deno-lint-ignore no-explicit-any
export type Token = Record<string, any>

// https://github.com/Microsoft/TypeScript/issues/5326
export class Attribute {
	name!: string
	value!: string

	constructor(args?: Partial<Attribute>) {
		Object.assign(this, { name: '', value: '' } as Attribute, args)
	}
}

class TagToken {
	tagName?: string
	/** https://html.spec.whatwg.org/multipage/parsing.html#self-closing-flag */
	selfClosingFlag!: boolean
	attributes!: Set<Attribute>

	constructor(args?: Partial<TagToken>) {
		Object.assign(
			this,
			{ selfClosingFlag: false, attributes: new Set() } as TagToken,
			args,
		)
	}
}

class DataToken {
	constructor(public data: string = '') {}
}

export class DOCTYPEToken {
	name?: string
	publicIdentifier?: string
	systemIdentifier?: string
	/** https://html.spec.whatwg.org/multipage/parsing.html#force-quirks-flag */
	forceQuirksFlag!: boolean

	constructor(args?: Partial<DOCTYPEToken>) {
		Object.assign(this, { forceQuirksFlag: false } as DOCTYPEToken, args)
	}
}

export class StartTagToken extends TagToken {}
export class EndTagToken extends TagToken {}
export class CommentToken extends DataToken {}
export class CharacterToken extends DataToken {}
export class EndOfFileToken {}
