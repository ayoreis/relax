import type { Token } from './token.ts'
import {
	Attribute,
	DOCTYPEToken,
	StartTagToken,
	EndTagToken,
	CommentToken,
	CharacterToken,
	EndOfFileToken,
} from './token.ts'
import {
	isSurrogate,
	isNoncharacter,
	isASCIIWhitespace,
	isControl,
	isASCIIDigit,
	isASCIIUpperHexDigit,
	isASCIILowerHexDigit,
	isASCIIHexDigit,
	isASCIIUpperAlpha,
	isASCIILowerAlpha,
	isASCIIAlpha,
	isASCIIAlphanumeric,
	ASCIICaseInsensitive,
} from './code-points.ts'
import namedCharacterReferences from './named-character-references.json' assert { type: 'json' }

type State = () => void

const NEXT_NAMED_CHARACTER_REFERENCE_REGEX = new RegExp(
	`^(?:${Object.keys(namedCharacterReferences).join('|')})`,
)

/** https://html.spec.whatwg.org/multipage/parsing.html#tokenization */
export class Tokenizer {
	#input: string
	#index = 0
	/** https://html.spec.whatwg.org/multipage/parsing.html#current-input-character */
	#currentInputCharacter!: string
	/** https://html.spec.whatwg.org/multipage/parsing.html#next-input-character */
	#nextInputCharacter: string
	#isEndOfFile = false
	#currentToken!: Token
	/** https://html.spec.whatwg.org/multipage/parsing.html#return-state */
	#returnState!: State
	#nextFewCharacters: string
	#state: State = this.dataState
	/** https://html.spec.whatwg.org/multipage/parsing.html#temporary-buffer */
	#temporaryBuffer!: string
	/** https://html.spec.whatwg.org/multipage/parsing.html#appropriate-end-tag-token */
	#lastEmitedStartTagToken!: StartTagToken
	#currentAttribute!: Attribute
	/** https://html.spec.whatwg.org/multipage/parsing.html#charref-in-attribute */
	#consumedAsPartOfAttribute!: boolean
	/** https://html.spec.whatwg.org/multipage/parsing.html#character-reference-code */
	#characterReferenceCode!: number

	constructor(input: string) {
		this.#input = input
		this.#nextInputCharacter = this.#input[this.#index]
		this.#nextFewCharacters = this.#input
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#appropriate-end-tag-token */
	isAppropriateEndTagToken(endTagToken: EndTagToken) {
		return this.#lastEmitedStartTagToken.tagName === endTagToken.tagName
	}

	consume(string: string) {
		this.#consumedAsPartOfAttribute =
			this.#returnState === this.attributeValueDoubleQuotedState ||
			this.#returnState === this.attributeValueSingleQuotedState ||
			this.#returnState === this.attributeValueUnquotedState

		this.#isEndOfFile = typeof string === 'undefined'

		if (this.#isEndOfFile) return

		this.#index += string.length
		this.#currentInputCharacter = string.at(-1)!
		this.#nextInputCharacter = this.#input[this.#index]
		this.#nextFewCharacters = this.#input.slice(this.#index)
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rethis.consume */
	reconsumeIn(state: State) {
		this.#index--
		this.#nextInputCharacter = this.#currentInputCharacter

		this.switchTo(state)
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#flush-code-points-this.consumed-as-a-character-reference */
	flushCodePointsConsumedAsCharacterReference() {
		/** https://infra.spec.whatwg.org/#code-point */
		for (const codePoint of this.#temporaryBuffer) {
			if (this.#consumedAsPartOfAttribute) {
				this.#currentAttribute.value += codePoint
			} else {
				this.emit(new CharacterToken(codePoint))
			}
		}
	}

	emit(token: Token) {
		if (token instanceof StartTagToken) {
			this.#lastEmitedStartTagToken = token
		}

		console.log(token)
	}

	switchTo(newState: State) {
		if (this.#state === this.attributeNameState) {
			const usedNames = new Set<string>()
			const { attributes } = this.#currentToken

			for (const attribute of attributes) {
				const { name } = attribute
				const used = usedNames.has(name)

				usedNames.add(name)

				if (used) {
					attributes.delete(attribute)
				}
			}
		}

		this.#state = newState
	}

	nextFewCharactersAre(matcher: string | RegExp) {
		if (typeof matcher === 'string')
			return this.#nextFewCharacters.startsWith(matcher)

		return new RegExp(
			`^${matcher.source.replace(/^\^?(?<RegEx>.*?)\$?$/, '$<RegEx>')}`,
		).test(this.#nextFewCharacters)
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#data-state */
	dataState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '&') {
			this.#returnState = this.dataState
			this.switchTo(this.characterReferenceState)
		} else if (this.#currentInputCharacter === '<') {
			this.switchTo(this.tagOpenState)
		} else if (this.#currentInputCharacter === '\0') {
			this.emit(new CharacterToken(this.#currentInputCharacter))
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.emit(new CharacterToken(this.#currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rcdata-state */
	RCDATAState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '&') {
			this.#returnState = this.RCDATAState
			this.switchTo(this.characterReferenceState)
		} else if (this.#currentInputCharacter === '<') {
			this.switchTo(this.RCDATALessThanSignState)
		} else if (this.#currentInputCharacter === '\0') {
			this.emit(new CharacterToken('\uFFFD'))
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.emit(new CharacterToken(this.#currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rawtext-state */
	RAWTEXTState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '<') {
			this.switchTo(this.RAWTEXTLessThanSignState)
		} else if (this.#currentInputCharacter === '\0') {
			this.emit(new CharacterToken('\uFFFD'))
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.emit(new CharacterToken(this.#currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-state */
	scriptDataState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '<') {
			this.switchTo(this.scriptDataLessThanSignState)
		} else if (this.#currentInputCharacter === '\0') {
			this.emit(new CharacterToken('\uFFFD'))
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.emit(new CharacterToken(this.#currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#plaintext-state */
	PLAINTEXTState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '\0') {
			this.emit(new CharacterToken('\uFFFD'))
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.emit(new CharacterToken(this.#currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#tag-open-state */
	tagOpenState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '!') {
			this.switchTo(this.markupDeclarationOpenState)
		} else if (this.#currentInputCharacter === '/') {
			this.switchTo(this.endTagOpenState)
		} else if (isASCIIAlpha(this.#currentInputCharacter)) {
			this.#currentToken = new StartTagToken({ tagName: '' })
			this.reconsumeIn(this.tagNameState)
		} else if (this.#currentInputCharacter === '?') {
			this.#currentToken = new CommentToken('')
			this.reconsumeIn(this.bogusCommentState)
		} else if (this.#isEndOfFile) {
			this.emit(new CharacterToken('<'))
			this.emit(new EndOfFileToken())
		} else {
			this.emit(new CharacterToken('<'))
			this.reconsumeIn(this.dataState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#end-tag-open-state */
	endTagOpenState() {
		this.consume(this.#nextInputCharacter)

		if (isASCIIAlpha(this.#currentInputCharacter)) {
			this.#currentToken = new EndTagToken({ tagName: '' })
			this.reconsumeIn(this.tagNameState)
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
		} else if (this.#isEndOfFile) {
			this.emit(new CharacterToken('<'))
			this.emit(new CharacterToken('/'))
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken = new CommentToken('')
			this.reconsumeIn(this.bogusCommentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#tag-name-state */
	tagNameState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
			this.switchTo(this.beforeAttributeNameState)
		} else if (this.#currentInputCharacter === '/') {
			this.switchTo(this.selfClosingStartTagState)
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState) //
			this.emit(this.#currentToken)
		} else if (isASCIIUpperAlpha(this.#currentInputCharacter)) {
			this.#currentToken.tagName +=
				this.#currentInputCharacter.toLowerCase()
		} else if (this.#currentInputCharacter === '\0') {
			this.#currentToken.tagName += '\uFFFD'
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.tagName += this.#currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rcdata-less-than-sign-state */
	RCDATALessThanSignState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '/') {
			this.#temporaryBuffer = ''
			this.switchTo(this.RCDATAEndTagOpenState)
		} else {
			this.emit(new CharacterToken('\u003C'))
			this.reconsumeIn(this.RCDATAState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rcdata-end-tag-open-state */
	RCDATAEndTagOpenState() {
		this.consume(this.#nextInputCharacter)

		if (isASCIIAlpha(this.#currentInputCharacter)) {
			this.#currentToken = new EndTagToken({ tagName: '' })
			this.reconsumeIn(this.RCDATAEndTagNameState)
		} else {
			this.emit(new CharacterToken('<'))
			this.emit(new CharacterToken('/'))
			this.reconsumeIn(this.RCDATAState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rcdata-end-tag-name-state */
	RCDATAEndTagNameState() {
		this.consume(this.#nextInputCharacter)

		if (
			(this.#currentInputCharacter === '\t' ||
				this.#currentInputCharacter === '\n' ||
				this.#currentInputCharacter === '\f' ||
				this.#currentInputCharacter === ' ') &&
			this.isAppropriateEndTagToken(this.#currentToken)
		) {
			this.switchTo(this.beforeAttributeNameState)
		} else if (
			this.#currentInputCharacter == '/' &&
			this.isAppropriateEndTagToken(this.#currentToken)
		) {
			this.switchTo(this.selfClosingStartTagState)
		} else if (
			this.#currentInputCharacter === '>' &&
			this.isAppropriateEndTagToken(this.#currentToken)
		) {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (isASCIIUpperAlpha(this.#currentInputCharacter)) {
			this.#currentToken.tagName +=
				this.#currentInputCharacter.toLowerCase()
			this.#temporaryBuffer += this.#currentInputCharacter
		} else if (isASCIILowerAlpha(this.#currentInputCharacter)) {
			this.#currentToken.tagName += this.#currentInputCharacter
			this.#temporaryBuffer += this.#currentInputCharacter
		} else {
			this.emit(new CharacterToken('<'))
			this.emit(new CharacterToken('/'))

			for (const character of this.#temporaryBuffer) {
				this.emit(new CharacterToken(character))
			}

			this.reconsumeIn(this.RCDATAState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rawtext-less-than-sign-state */
	RAWTEXTLessThanSignState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '/') {
			this.#temporaryBuffer = ''
			this.switchTo(this.RAWTEXTEndTagOpenState)
		} else {
			this.emit(new CharacterToken('<'))
			this.reconsumeIn(this.RAWTEXTState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rawtext-end-tag-open-state */
	RAWTEXTEndTagOpenState() {
		this.consume(this.#nextInputCharacter)

		if (isASCIIAlpha(this.#currentInputCharacter)) {
			this.#currentToken = new EndTagToken({ tagName: '' })
			this.reconsumeIn(this.RAWTEXTEndTagNameState)
		} else {
			this.emit(new CharacterToken('-'))
			this.emit(new CharacterToken('/'))
			this.reconsumeIn(this.RAWTEXTState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rawtext-end-tag-name-state */
	RAWTEXTEndTagNameState() {
		this.consume(this.#nextFewCharacters)

		if (
			(this.#currentInputCharacter === '\t' ||
				this.#currentInputCharacter === '\n' ||
				this.#currentInputCharacter === '\f' ||
				this.#currentInputCharacter === ' ') &&
			this.isAppropriateEndTagToken(this.#currentToken)
		) {
			this.switchTo(this.beforeAttributeNameState)
		} else if (
			this.#currentInputCharacter === '/' &&
			this.isAppropriateEndTagToken(this.#currentToken)
		) {
			this.switchTo(this.selfClosingStartTagState)
		} else if (
			this.#currentInputCharacter === '>' &&
			this.isAppropriateEndTagToken(this.#currentToken)
		) {
			this.switchTo(this.dataState)
		} else if (isASCIIUpperAlpha(this.#currentInputCharacter)) {
			this.#currentToken.tagName +=
				this.#currentInputCharacter.toLowerCase()
			this.#temporaryBuffer += this.#currentInputCharacter
		} else if (isASCIILowerAlpha(this.#currentInputCharacter)) {
			this.#currentToken.tagName += this.#currentInputCharacter
			this.#temporaryBuffer += this.#currentInputCharacter
		} else {
			this.emit(new CharacterToken('<'))
			this.emit(new CharacterToken('/'))

			for (const character of this.#temporaryBuffer) {
				this.emit(new CharacterToken(character))
			}

			this.reconsumeIn(this.RAWTEXTState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-less-than-sign-state */
	scriptDataLessThanSignState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '/') {
			this.#temporaryBuffer = ''
			this.switchTo(this.scriptDataEndTagOpenState)
		} else if (this.#currentInputCharacter === '!') {
			this.switchTo(this.scriptDataEscapeStartState)
			this.emit(new CharacterToken('<'))
			this.emit(new CharacterToken('!'))
		} else {
			this.emit(new CharacterToken('<'))
			this.reconsumeIn(this.scriptDataState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-end-tag-open-state */
	scriptDataEndTagOpenState() {
		this.consume(this.#nextInputCharacter)

		if (isASCIIAlpha(this.#currentInputCharacter)) {
			this.#currentToken = new EndTagToken({ tagName: '' })
			this.reconsumeIn(this.scriptDataEndTagNameState)
		} else {
			this.emit(new CharacterToken('<'))
			this.emit(new CharacterToken('/'))
			this.reconsumeIn(this.scriptDataState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-end-tag-name-state */
	scriptDataEndTagNameState() {
		this.consume(this.#nextInputCharacter)

		if (
			(this.#currentInputCharacter === '\t' ||
				this.#currentInputCharacter === '\n' ||
				this.#currentInputCharacter === '\f' ||
				this.#currentInputCharacter === ' ') &&
			this.isAppropriateEndTagToken(this.#currentToken)
		) {
			this.switchTo(this.beforeAttributeNameState)
		} else if (
			this.#currentInputCharacter === '/' &&
			this.isAppropriateEndTagToken(this.#currentToken)
		) {
			this.switchTo(this.selfClosingStartTagState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escape-start-state */
	scriptDataEscapeStartState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.switchTo(this.scriptDataEscapeStartDashState)
			this.emit(new CharacterToken('-'))
		} else {
			this.reconsumeIn(this.scriptDataState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escape-start-dash-state */
	scriptDataEscapeStartDashState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.switchTo(this.scriptDataEscapedDashDashState)
		} else {
			this.reconsumeIn(this.scriptDataState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escaped-state */
	scriptDataEscapedState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.switchTo(this.scriptDataEscapedDashState)
			this.emit(new CharacterToken('-'))
		} else if (this.#currentInputCharacter === '<') {
			this.switchTo(this.scriptDataEscapedLessThanSignState)
		} else if (this.#currentInputCharacter === '\0') {
			this.emit(new CharacterToken('\uFFFD'))
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.emit(new CharacterToken(this.#currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escaped-dash-state */
	scriptDataEscapedDashState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.switchTo(this.scriptDataEscapedDashDashState)
			this.emit(new CharacterToken('-'))
		} else if (this.#currentInputCharacter === '<') {
			this.switchTo(this.scriptDataEscapedLessThanSignState)
		} else if (this.#currentInputCharacter === '\0') {
			this.switchTo(this.scriptDataEscapedState)
			this.emit(new CharacterToken('\uFFFD'))
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.switchTo(this.scriptDataEscapedState)
			this.emit(new CharacterToken(this.#currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escaped-dash-dash-state */
	scriptDataEscapedDashDashState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.emit(new CharacterToken('-'))
		} else if (this.#currentInputCharacter === '<') {
			this.switchTo(this.scriptDataEscapedLessThanSignState)
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.scriptDataState)
			this.emit(new CharacterToken('>'))
		} else if (this.#currentInputCharacter === '\0') {
			this.switchTo(this.scriptDataState)
			this.emit(new CharacterToken('\uFFFD'))
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.switchTo(this.scriptDataEscapedState)
			this.emit(new CharacterToken(this.#currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escaped-less-than-sign-state */
	scriptDataEscapedLessThanSignState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '/') {
			this.#temporaryBuffer = ''
			this.switchTo(this.scriptDataEscapedEndTagOpenState)
		} else if (isASCIIAlpha(this.#currentInputCharacter)) {
			this.#temporaryBuffer = ''
			this.emit(new CharacterToken('<'))
			this.reconsumeIn(this.scriptDataDoubleEscapeStartState)
		} else {
			this.emit(new CharacterToken('<'))
			this.reconsumeIn(this.scriptDataState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escaped-end-tag-open-state */
	scriptDataEscapedEndTagOpenState() {
		this.consume(this.#nextInputCharacter)

		if (isASCIIAlpha(this.#currentInputCharacter)) {
			this.#currentToken = new EndTagToken({ tagName: '' })
			this.reconsumeIn(this.scriptDataEscapedEndTagNameState)
		} else {
			this.emit(new CharacterToken('<'))
			this.emit(new CharacterToken('/'))
			this.reconsumeIn(this.scriptDataEscapedState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escaped-end-tag-name-state */
	scriptDataEscapedEndTagNameState() {
		this.consume(this.#nextInputCharacter)

		if (
			(this.#currentInputCharacter === '\t' ||
				this.#currentInputCharacter === '\n' ||
				this.#currentInputCharacter === '\f' ||
				this.#currentInputCharacter === ' ') &&
			this.isAppropriateEndTagToken(this.#currentToken)
		) {
			this.switchTo(this.beforeAttributeNameState)
		} else if (
			this.#currentInputCharacter === '/' &&
			this.isAppropriateEndTagToken(this.#currentToken)
		) {
			this.switchTo(this.selfClosingStartTagState)
		} else if (
			this.#currentInputCharacter === '>' &&
			this.isAppropriateEndTagToken(this.#currentToken)
		) {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (isASCIIUpperAlpha(this.#currentInputCharacter)) {
			this.#currentToken.tagName +=
				this.#currentInputCharacter.toLowerCase()
			this.#temporaryBuffer += this.#currentInputCharacter.toLowerCase()
		} else if (isASCIILowerAlpha(this.#currentInputCharacter)) {
			this.#currentToken.tagName += this.#currentInputCharacter
			this.#temporaryBuffer += this.#currentInputCharacter
		} else {
			this.emit(new CharacterToken('<'))
			this.emit(new CharacterToken('/'))

			for (const character of this.#temporaryBuffer) {
				this.emit(new CharacterToken(character))
			}

			this.reconsumeIn(this.scriptDataEscapedState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escape-start-state */
	scriptDataDoubleEscapeStartState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
			if (this.#temporaryBuffer === 'script') {
				this.switchTo(this.scriptDataDoubleEscapedState)
			} else {
				this.switchTo(this.scriptDataEscapedState)
			}

			this.emit(new CharacterToken(this.#currentInputCharacter))
		} else if (isASCIIUpperAlpha(this.#currentInputCharacter)) {
			this.#temporaryBuffer += this.#currentInputCharacter.toLowerCase()
			this.emit(new CharacterToken(this.#currentInputCharacter))
		} else if (isASCIILowerAlpha(this.#currentInputCharacter)) {
			this.#temporaryBuffer += this.#currentInputCharacter
			this.emit(new CharacterToken(this.#currentInputCharacter))
		} else {
			this.reconsumeIn(this.scriptDataEscapedState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escaped-state */
	scriptDataDoubleEscapedState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.switchTo(this.scriptDataDoubleEscapedDashState)
			this.emit(new CharacterToken('-'))
		} else if (this.#currentInputCharacter === '<') {
			this.switchTo(this.scriptDataDoubleEscapedLessThanSignState)
			this.emit(new CharacterToken('<'))
		} else if (this.#currentInputCharacter === '\0') {
			this.emit(new CharacterToken('\uFFFD'))
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.emit(new CharacterToken(this.#currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escaped-dash-state */
	scriptDataDoubleEscapedDashState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.switchTo(this.scriptDataDoubleEscapedDashDashState)
			this.emit(new CharacterToken('-'))
		} else if (this.#currentInputCharacter === '<') {
			this.switchTo(this.scriptDataDoubleEscapedLessThanSignState)
			this.emit(new CharacterToken('<'))
		} else if (this.#currentInputCharacter === '\0') {
			this.switchTo(this.scriptDataState)
			this.emit(new CharacterToken('\uFFFD'))
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.switchTo(this.scriptDataDoubleEscapedState)
			this.emit(new CharacterToken(this.#currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escaped-dash-dash-state */
	scriptDataDoubleEscapedDashDashState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.emit(new CharacterToken('-'))
		} else if (this.#currentInputCharacter === '<') {
			this.switchTo(this.scriptDataDoubleEscapedLessThanSignState)
			this.emit(new CharacterToken('<'))
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.scriptDataState)
			this.emit(new CharacterToken('>'))
		} else if (this.#currentInputCharacter === '\0') {
			this.switchTo(this.scriptDataState)
			this.emit(new CharacterToken('\uFFFD'))
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.switchTo(this.scriptDataDoubleEscapedState)
			this.emit(new CharacterToken(this.#currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escaped-less-than-sign-state */
	scriptDataDoubleEscapedLessThanSignState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '/') {
			this.#temporaryBuffer = ''
			this.switchTo(this.scriptDataDoubleEscapeEndState)
			this.emit(new CharacterToken('/'))
		} else {
			this.reconsumeIn(this.scriptDataEscapedState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escape-end-state */
	scriptDataDoubleEscapeEndState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
			if (this.#temporaryBuffer === 'script') {
				this.switchTo(this.scriptDataEscapedState)
			} else {
				this.switchTo(this.scriptDataDoubleEscapedState)
			}

			this.emit(new CharacterToken(this.#currentInputCharacter))
		} else if (isASCIIUpperAlpha(this.#currentInputCharacter)) {
			this.#currentToken.tagName +=
				this.#currentInputCharacter.toLowerCase()
			this.emit(new CharacterToken(this.#currentInputCharacter))
		} else if (isASCIILowerAlpha(this.#currentInputCharacter)) {
			this.#currentToken.tagName += this.#currentInputCharacter
			this.emit(new CharacterToken(this.#currentInputCharacter))
		} else {
			this.reconsumeIn(this.scriptDataDoubleEscapedState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#before-attribute-name-state */
	beforeAttributeNameState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
		} else if (
			this.#currentInputCharacter === '/' ||
			this.#currentInputCharacter === '>' ||
			this.#isEndOfFile
		) {
			this.reconsumeIn(this.afterAttributeNameState)
		} else if (this.#currentInputCharacter === '=') {
			this.#currentAttribute = new Attribute({
				name: this.#currentInputCharacter,
				value: '',
			})

			this.#currentToken.attributes.add(this.#currentAttribute)
			this.switchTo(this.attributeNameState)
		} else {
			this.#currentAttribute = new Attribute({ name: '', value: '' })
			this.#currentToken.attributes.add(this.#currentAttribute)
			this.reconsumeIn(this.attributeNameState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#attribute-name-state */
	attributeNameState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' ' ||
			this.#currentInputCharacter === '/' ||
			this.#currentInputCharacter === '>' ||
			this.#isEndOfFile
		) {
			this.reconsumeIn(this.afterAttributeNameState)
		} else if (this.#currentInputCharacter === '=') {
			this.switchTo(this.beforeAttributeValueState)
		} else if (isASCIIUpperAlpha(this.#currentInputCharacter)) {
			this.#currentAttribute.name +=
				this.#currentInputCharacter.toLowerCase()
		} /* else if (
			this.#currentInputCharacter === '"' ||
			this.#currentInputCharacter === "'" ||
			this.#currentInputCharacter === '<'
		) {
		} */ else {
			this.#currentAttribute.name += this.#currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#after-attribute-name-state */
	afterAttributeNameState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
		} else if (this.#currentInputCharacter === '/') {
			this.switchTo(this.selfClosingStartTagState)
		} else if (this.#currentInputCharacter === '=') {
			this.switchTo(this.beforeAttributeValueState)
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.#currentAttribute = new Attribute({ name: '', value: '' })
			this.#currentToken.attributes.add(this.#currentAttribute)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#before-attribute-value-state */
	beforeAttributeValueState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
		} else if (this.#currentInputCharacter === '"') {
			this.switchTo(this.attributeValueDoubleQuotedState)
		} else if (this.#currentInputCharacter === "'") {
			this.switchTo(this.attributeValueSingleQuotedState)
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else {
			this.reconsumeIn(this.attributeValueUnquotedState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(double-quoted)-state */
	attributeValueDoubleQuotedState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '"') {
			this.switchTo(this.afterAttributeValueQuotedState)
		} else if (this.#currentInputCharacter === '&') {
			this.#returnState = this.attributeValueDoubleQuotedState
			this.switchTo(this.characterReferenceState)
		} else if (this.#currentInputCharacter === '\0') {
			this.#currentAttribute.value += '\uFFFD'
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.#currentAttribute.value += this.#currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(single-quoted)-state */
	attributeValueSingleQuotedState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === "'") {
			this.switchTo(this.afterAttributeValueQuotedState)
		} else if (this.#currentInputCharacter === '&') {
			this.#returnState = this.attributeValueSingleQuotedState
			this.switchTo(this.characterReferenceState)
		} else if (this.#currentInputCharacter === '\0') {
			this.#currentAttribute.value += '\uFFFD'
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.#currentAttribute.value += this.#currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(unquoted)-state */
	attributeValueUnquotedState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
			this.switchTo(this.beforeAttributeNameState)
		} else if (this.#currentInputCharacter === '&') {
			this.#returnState = this.attributeValueUnquotedState
			this.switchTo(this.characterReferenceState)
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#currentInputCharacter === '\0') {
			this.#currentAttribute.name += '\uFFFD'
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} /* else if (
			this.#currentInputCharacter === '"' ||
			this.#currentInputCharacter === "'" ||
			this.#currentInputCharacter === '<' ||
			this.#currentInputCharacter === '=' ||
			this.#currentInputCharacter === '`'
		) {
		} */ else {
			this.#currentAttribute.value += this.#currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#after-attribute-value-(quoted)-state */
	afterAttributeValueQuotedState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
			this.switchTo(this.beforeAttributeNameState)
		} else if (this.#currentInputCharacter === '/') {
			this.switchTo(this.selfClosingStartTagState)
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.reconsumeIn(this.beforeAttributeNameState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#self-closing-start-tag-state */
	selfClosingStartTagState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '>') {
			this.#currentToken.selfClosingFlag = true
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.reconsumeIn(this.beforeAttributeNameState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#bogus-comment-state */
	bogusCommentState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else if (this.#currentInputCharacter === '\0') {
			this.#currentToken.data += this.#currentInputCharacter
		} else {
			this.#currentToken.data += this.#currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#markup-declaration-open-state */
	markupDeclarationOpenState() {
		if (this.nextFewCharactersAre('--')) {
			this.consume('--')
			this.#currentToken = new CommentToken()
			this.switchTo(this.commentStartState)
		} else if (this.nextFewCharactersAre(ASCIICaseInsensitive('DOCTYPE'))) {
			// TODO Should this.consume matched characters.
			this.consume('DOCTYPE')
			this.switchTo(this.DOCTYPEState)
		} else if (this.nextFewCharactersAre(`[CDATA[`)) {
			// TODO
			this.consume('[CDATA[')

			if (adjustedCurrentNode) {
				this.switchTo(this.CDATASectionState)
			} else {
				this.#currentToken = new CommentToken('[CDATA[')
				this.switchTo(this.bogusCommentState)
			}
		} else {
			this.#currentToken = new CommentToken()
			this.switchTo(this.bogusCommentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-start-state */
	commentStartState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.switchTo(this.commentStartDashState)
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else {
			this.reconsumeIn(this.commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-start-dash-state */
	commentStartDashState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.switchTo(this.commentEndState)
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.data += '-'
			this.reconsumeIn(this.commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-state */
	commentState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '<') {
			this.#currentToken.data += this.#currentInputCharacter
			this.switchTo(this.commentLessThanSignState)
		} else if (this.#currentInputCharacter === '-') {
			this.switchTo(this.commentEndDashState)
		} else if (this.#currentInputCharacter === '\0') {
			this.#currentToken.data += '\uFFFD'
		} else if (this.#isEndOfFile) {
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.data += this.#currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-less-than-sign-state */
	commentLessThanSignState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '!') {
			this.#currentToken.data += this.#currentInputCharacter
			this.switchTo(this.commentLessThanSignBangState)
		} else if (this.#currentInputCharacter === '<') {
			this.#currentToken.data += this.#currentInputCharacter
		} else {
			this.reconsumeIn(this.commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-less-than-sign-bang-state */
	commentLessThanSignBangState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.switchTo(this.commentLessThanSignBangDashState)
		} else {
			this.reconsumeIn(this.commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-less-than-sign-bang-dash-state */
	commentLessThanSignBangDashState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.switchTo(this.commentLessThanSignBangDashDashState)
		} else {
			this.reconsumeIn(this.commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-less-than-sign-bang-dash-dash-state */
	commentLessThanSignBangDashDashState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '>' || this.#isEndOfFile) {
			this.reconsumeIn(this.commentEndState)
		} else {
			this.reconsumeIn(this.commentEndState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-end-dash-state */
	commentEndDashState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.switchTo(this.commentEndState)
		} else if (this.#isEndOfFile) {
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.data += '-'
			this.reconsumeIn(this.commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-end-state */
	commentEndState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#currentInputCharacter === '!') {
			this.switchTo(this.commentEndBangState)
		} else if (this.#currentInputCharacter === '-') {
			this.#currentToken.data += '-'
		} else if (this.#isEndOfFile) {
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.data += '--'
			this.reconsumeIn(this.commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-end-bang-state */
	commentEndBangState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '-') {
			this.#currentToken.data += '-!'
			this.switchTo(this.commentEndDashState)
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.data += '--!'
			this.reconsumeIn(this.commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#doctype-state */
	DOCTYPEState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
			this.switchTo(this.beforeDOCTYPENameState)
		} else if (this.#currentInputCharacter === '>') {
			this.reconsumeIn(this.beforeDOCTYPENameState)
		} else if (this.#isEndOfFile) {
			this.#currentToken = new DOCTYPEToken({ forceQuirksFlag: true })
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.reconsumeIn(this.beforeDOCTYPENameState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#before-doctype-name-state */
	beforeDOCTYPENameState() {
		this.consume(this.#nextInputCharacter)
		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
		} else if (isASCIIUpperAlpha(this.#currentInputCharacter)) {
			this.#currentToken = new DOCTYPEToken({
				name: this.#currentInputCharacter.toLowerCase(),
			})

			this.switchTo(this.DOCTYPENameState)
		} else if (this.#currentInputCharacter === '\0') {
			this.#currentToken = new DOCTYPEToken({ name: '\uFFFD' })
			this.switchTo(this.DOCTYPENameState)
		} else if (this.#currentInputCharacter === '>') {
			this.#currentToken = new DOCTYPEToken({
				forceQuirks: true,
			})

			this.switchTo(this.DOCTYPENameState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.#currentToken = new DOCTYPEToken({ forceQuirksFlag: true })
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken = new DOCTYPEToken({
				name: this.#currentInputCharacter,
			})
			this.switchTo(this.DOCTYPENameState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#doctype-name-state */
	DOCTYPENameState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
			this.switchTo(this.afterDOCTYPENameState)
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (isASCIIUpperAlpha(this.#currentInputCharacter)) {
			this.#currentToken.name += this.#currentInputCharacter.toLowerCase()
		} else if (this.#currentInputCharacter === '\0') {
			this.#currentToken.name += '\uFFFD'
		} else if (this.#isEndOfFile) {
			this.#currentToken.forceQuirksFlag = true
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.name += this.#currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#after-doctype-name-state */
	afterDOCTYPENameState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.#currentToken.forceQuirksFlag = true
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			const sixCharactersStartingFromCurrentInputCharacter =
				this.#input.slice(this.#index - 1, this.#index + 5)

			if (
				ASCIICaseInsensitive('PUBLIC').test(
					sixCharactersStartingFromCurrentInputCharacter,
				)
			) {
				this.consume(sixCharactersStartingFromCurrentInputCharacter)
				this.switchTo(this.afterDOCTYPEPublicKeywordState)
			} else if (
				ASCIICaseInsensitive('SYSTEM').test(
					sixCharactersStartingFromCurrentInputCharacter,
				)
			) {
				this.consume(sixCharactersStartingFromCurrentInputCharacter)
				this.switchTo(this.afterDOCTYPESystemKeywordState)
			} else {
				this.#currentToken.forceQuirksFlag = true
				this.reconsumeIn(this.bogusCommentState)
			}
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#after-doctype-public-keyword-state */
	afterDOCTYPEPublicKeywordState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
			this.switchTo(this.beforeDOCTYPEPublicIdentifierState)
		} else if (this.#currentInputCharacter === '"') {
			this.#currentToken.publicIdentifier = ''
			this.switchTo(this.DOCTYPEPublicIdentifierDoubleQuotedState)
		} else if (this.#currentInputCharacter === '>') {
			this.#currentToken.forceQuirksFlag = true
			this.switchTo(this.dataState)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.forceQuirksFlag = true
			this.reconsumeIn(this.bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#before-doctype-public-identifier-state */
	beforeDOCTYPEPublicIdentifierState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
		} else if (this.#currentInputCharacter === '"') {
			this.#currentToken.publicIdentifier = ''
			this.switchTo(this.DOCTYPEPublicIdentifierDoubleQuotedState)
		} else if (this.#currentInputCharacter === "'") {
			this.#currentToken.publicIdentifier = ''
			this.switchTo(this.DOCTYPEPublicIdentifierSingleQuotedState)
		} else if (this.#currentInputCharacter === '>') {
			this.#currentToken.forceQuirksFlag = true
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.#currentToken.forceQuirksFlag = true
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.forceQuirksFlag = true
			this.reconsumeIn(this.bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#doctype-public-identifier-(double-quoted)-state */
	DOCTYPEPublicIdentifierDoubleQuotedState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '"') {
			this.switchTo(this.afterDOCTYPEPublicIdentifierState)
		} else if (this.#currentInputCharacter === '\0') {
			this.#currentToken.publicIdentifier += '\uFFFD'
		} else if (this.#currentInputCharacter === '>') {
			this.#currentToken.forceQuirksFlag = true
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.#currentToken.forceQuirksFlag = true
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.publicIdentifier += this.#currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#doctype-public-identifier-(single-quoted)-state */
	DOCTYPEPublicIdentifierSingleQuotedState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === "'") {
			this.switchTo(this.afterDOCTYPEPublicIdentifierState)
		} else if (this.#currentInputCharacter === '\0') {
			this.#currentToken.publicIdentifier += '\uFFFD'
		} else if (this.#currentInputCharacter === '>') {
			this.#currentToken.forceQuirksFlag = true
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.#currentToken.forceQuirksFlag = true
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.publicIdentifier += this.#currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#after-doctype-public-identifier-state */
	afterDOCTYPEPublicIdentifierState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
			this.switchTo(this.betweenDOCTYPEPublicAndSystemIdentifierState)
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#currentInputCharacter === '"') {
			this.#currentToken.systemIdentifier = ''
			this.switchTo(this.DOCTYPESystemIdentifierDoubleQuotedState)
		} else if (this.#currentInputCharacter === "'") {
			this.#currentToken.systemIdentifier = ''
			this.switchTo(this.DOCTYPESystemIdentifierSingleQuotedState)
		} else if (this.#isEndOfFile) {
			this.#currentToken.forceQuirksFlag = true
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.forceQuirksFlag = true
			this.reconsumeIn(this.bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#between-doctype-public-and-system-identifiers-state */
	betweenDOCTYPEPublicAndSystemIdentifierState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#currentInputCharacter === '"') {
			this.#currentToken.systemIdentifier = ''
			this.switchTo(this.DOCTYPESystemIdentifierDoubleQuotedState)
		} else if (this.#currentInputCharacter === "'") {
			this.#currentToken.systemIdentifier = ''
			this.switchTo(this.DOCTYPESystemIdentifierSingleQuotedState)
		} else if (this.#isEndOfFile) {
			this.#currentToken.forceQuirksFlag = true
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.forceQuirksFlag = true
			this.reconsumeIn(this.bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#before-doctype-system-identifier-state */
	afterDOCTYPESystemKeywordState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
			this.switchTo(this.beforeDOCTYPESystemIdentifierState)
		} else if (this.#currentInputCharacter === '"') {
			this.#currentToken.systemIdentifier = ''
			this.switchTo(this.DOCTYPESystemIdentifierDoubleQuotedState)
		} else if (this.#currentInputCharacter === '>') {
			this.#currentToken.forceQuirksFlag = true
			this.switchTo(this.dataState)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.forceQuirksFlag = true
			this.reconsumeIn(this.bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#before-doctype-system-identifier-state */
	beforeDOCTYPESystemIdentifierState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
		} else if (this.#currentInputCharacter === '"') {
			this.#currentToken.systemIdentifier = ''
			this.switchTo(this.DOCTYPESystemIdentifierDoubleQuotedState)
		} else if (this.#currentInputCharacter === "'") {
			this.#currentToken.systemIdentifier = ''
			this.switchTo(this.DOCTYPESystemIdentifierSingleQuotedState)
		} else if (this.#currentInputCharacter === '>') {
			this.#currentToken.forceQuirksFlag = true
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.#currentToken.forceQuirksFlag = true
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.forceQuirksFlag = true
			this.reconsumeIn(this.bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#doctype-system-identifier-(double-quoted)-state */
	DOCTYPESystemIdentifierDoubleQuotedState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '"') {
			this.switchTo(this.afterDOCTYPESystemIdentifierState)
		} else if (this.#currentInputCharacter === '\0') {
			this.#currentToken.systemIdentifier += '\uFFFD'
		} else if (this.#currentInputCharacter === '>') {
			this.#currentToken.forceQuirksFlag = true
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.#currentToken.forceQuirksFlag = true
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.systemIdentifier += this.#currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#doctype-system-identifier-(single-quoted)-state */
	DOCTYPESystemIdentifierSingleQuotedState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === "'") {
			this.switchTo(this.afterDOCTYPESystemIdentifierState)
		} else if (this.#currentInputCharacter === '\0') {
			this.#currentToken.systemIdentifier += '\uFFFD'
		} else if (this.#currentInputCharacter === '>') {
			this.#currentToken.forceQuirksFlag = true
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.#currentToken.forceQuirksFlag = true
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.#currentToken.systemIdentifier += this.#currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#after-doctype-system-identifier-state */
	afterDOCTYPESystemIdentifierState() {
		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === '\t' ||
			this.#currentInputCharacter === '\n' ||
			this.#currentInputCharacter === '\f' ||
			this.#currentInputCharacter === ' '
		) {
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#isEndOfFile) {
			this.#currentToken.forceQuirksFlag = true
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
			this.reconsumeIn(this.bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#bogus-doctype-state */
	bogusDOCTYPEState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
			this.emit(this.#currentToken)
		} else if (this.#currentInputCharacter === '\0') {
		} else if (this.#isEndOfFile) {
			this.emit(this.#currentToken)
			this.emit(new EndOfFileToken())
		} else {
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#cdata-section-state */
	CDATASectionState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === ']') {
			this.switchTo(this.CDATASectionBracketState)
		} else if (this.#isEndOfFile) {
			this.emit(new EndOfFileToken())
		} else {
			this.emit(new CharacterToken(this.#currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#cdata-section-bracket-state */
	CDATASectionBracketState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === ']') {
			this.switchTo(this.CDATASectionEndState)
		} else {
			this.emit(new CharacterToken(']'))
			this.reconsumeIn(this.CDATASectionState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#cdata-section-end-state */
	CDATASectionEndState() {
		this.consume(this.#nextInputCharacter)

		if (this.#currentInputCharacter === ']') {
			this.emit(new CharacterToken(']'))
		} else if (this.#currentInputCharacter === '>') {
			this.switchTo(this.dataState)
		} else {
			this.emit(new CharacterToken(']'))
			this.emit(new CharacterToken(']'))
			this.reconsumeIn(this.CDATASectionState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#character-reference-state */
	characterReferenceState() {
		this.#temporaryBuffer = ''
		this.#temporaryBuffer += '&'
		this.consume(this.#nextInputCharacter)

		if (isASCIIAlphanumeric(this.#currentInputCharacter)) {
			this.reconsumeIn(this.namedCharacterReferenceState)
		} else if (this.#currentInputCharacter === '#') {
			this.#temporaryBuffer += this.#currentInputCharacter
			this.switchTo(this.numericCharacterReferenceState)
		} else {
			this.flushCodePointsConsumedAsCharacterReference()
			this.reconsumeIn(this.#returnState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#named-character-reference-state */
	namedCharacterReferenceState() {
		const maximumNumberOfCharactersPossible: keyof typeof namedCharacterReferences =
			this.#input
				.slice(this.#index)
				.match(NEXT_NAMED_CHARACTER_REFERENCE_REGEX)?.[0] ?? ''

		this.consume(maximumNumberOfCharactersPossible)
		this.#temporaryBuffer += maximumNumberOfCharactersPossible

		if (maximumNumberOfCharactersPossible) {
			if (
				this.#consumedAsPartOfAttribute &&
				maximumNumberOfCharactersPossible.at(-1) !== ';' &&
				(this.#nextInputCharacter === '=' ||
					isASCIIAlphanumeric(this.#nextInputCharacter))
			) {
				this.flushCodePointsConsumedAsCharacterReference()
				this.switchTo(this.#returnState)
			} else {
				if (maximumNumberOfCharactersPossible.at(-1) === ';') {
				}

				this.#temporaryBuffer = ''
				this.#temporaryBuffer +=
					namedCharacterReferences[maximumNumberOfCharactersPossible]
				this.flushCodePointsConsumedAsCharacterReference()
				this.switchTo(this.#returnState)
			}
		} else {
			this.flushCodePointsConsumedAsCharacterReference()
			this.switchTo(this.ambiguousAmpersandState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#ambiguous-ampersand-state */
	ambiguousAmpersandState() {
		this.consume(this.#nextInputCharacter)

		if (isASCIIAlphanumeric(this.#currentInputCharacter)) {
			if (this.#consumedAsPartOfAttribute) {
				this.#currentAttribute.value += this.#currentInputCharacter
			} else {
				this.emit(new CharacterToken(this.#currentInputCharacter))
			}
		} else if (this.#currentInputCharacter === ';') {
			this.reconsumeIn(this.#returnState)
		} else {
			this.reconsumeIn(this.#returnState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-state */
	numericCharacterReferenceState() {
		this.#characterReferenceCode = 0

		this.consume(this.#nextInputCharacter)

		if (
			this.#currentInputCharacter === 'x' ||
			this.#currentInputCharacter === 'X'
		) {
			this.#temporaryBuffer += this.#currentInputCharacter
			this.switchTo(this.hexadecimalCharacterReferenceStartState)
		} else {
			this.reconsumeIn(this.decimalCharacterReferenceStartState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#hexadecimal-character-reference-start-state */
	hexadecimalCharacterReferenceStartState() {
		this.consume(this.#nextInputCharacter)

		if (isASCIIHexDigit(this.#currentInputCharacter)) {
			this.reconsumeIn(this.hexadecimalCharacterReferenceState)
		} else {
			this.flushCodePointsConsumedAsCharacterReference()
			this.reconsumeIn(this.#returnState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#decimal-character-reference-start-state */
	decimalCharacterReferenceStartState() {
		this.consume(this.#nextInputCharacter)

		if (isASCIIDigit(this.#currentInputCharacter)) {
			this.reconsumeIn(this.decimalCharacterReferenceState)
		} else {
			this.flushCodePointsConsumedAsCharacterReference()
			this.reconsumeIn(this.#returnState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#hexadecimal-character-reference-state */
	hexadecimalCharacterReferenceState() {
		this.consume(this.#nextInputCharacter)

		if (isASCIIDigit(this.#currentInputCharacter)) {
			this.#characterReferenceCode *= 16
			this.#characterReferenceCode +=
				this.#currentInputCharacter.charCodeAt(0) - 0x0030
		} else if (isASCIIUpperHexDigit(this.#currentInputCharacter)) {
			this.#characterReferenceCode *= 16
			this.#characterReferenceCode +=
				this.#currentInputCharacter.charCodeAt(0) - 0x0037
		} else if (isASCIILowerHexDigit(this.#currentInputCharacter)) {
			this.#characterReferenceCode *= 16
			this.#characterReferenceCode +=
				this.#currentInputCharacter.charCodeAt(0) - 0x0057
		} else if (this.#currentInputCharacter === ';') {
			this.switchTo(this.numericCharacterReferenceEndState)
		} else {
			this.reconsumeIn(this.numericCharacterReferenceEndState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#decimal-character-reference-state */
	decimalCharacterReferenceState() {
		this.consume(this.#nextInputCharacter)

		if (isASCIIDigit(this.#currentInputCharacter)) {
			this.#characterReferenceCode *= 10
			this.#characterReferenceCode +=
				this.#currentInputCharacter.charCodeAt(0) - 0x0030
		} else if (this.#currentInputCharacter === ';') {
			this.switchTo(this.numericCharacterReferenceEndState)
		} else {
			this.reconsumeIn(this.numericCharacterReferenceEndState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-end-state */
	numericCharacterReferenceEndState() {
		if (this.#characterReferenceCode === 0x00) {
			this.#characterReferenceCode = 0xfffd
		} else if (this.#characterReferenceCode > 0x10ffff) {
			this.#characterReferenceCode = 0xfffd
		} else if (isSurrogate(this.#characterReferenceCode)) {
			this.#characterReferenceCode = 0xfffd
		} else if (isNoncharacter(this.#characterReferenceCode)) {
		} else if (
			this.#characterReferenceCode === 0x0d ||
			(isControl(this.#characterReferenceCode) &&
				!isASCIIWhitespace(this.#characterReferenceCode))
		) {
		}

		const table = {
			0x80: 0x20ac,
			0x82: 0x201a,
			0x83: 0x0192,
			0x84: 0x201e,
			0x85: 0x2026,
			0x86: 0x2020,
			0x87: 0x2021,
			0x88: 0x02c6,
			0x89: 0x2030,
			0x8a: 0x0160,
			0x8b: 0x2039,
			0x8c: 0x0152,
			0x8e: 0x017d,
			0x91: 0x2018,
			0x92: 0x2019,
			0x93: 0x201c,
			0x94: 0x201d,
			0x95: 0x2022,
			0x96: 0x2013,
			0x97: 0x2014,
			0x98: 0x02dc,
			0x99: 0x2122,
			0x9a: 0x0161,
			0x9b: 0x203a,
			0x9c: 0x0153,
			0x9e: 0x017e,
			0x9f: 0x0178,
		} as const

		this.#characterReferenceCode =
			table[this.#characterReferenceCode] ?? this.#characterReferenceCode

		this.#temporaryBuffer = ''
		this.#temporaryBuffer += String.fromCodePoint(
			this.#characterReferenceCode,
		)
		this.flushCodePointsConsumedAsCharacterReference()
		this.switchTo(this.#returnState)
	}

	tokenize() {
		while (!this.#isEndOfFile) {
			this.#state()
		}
	}
}
