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

const NAMED_CHARACTER_REFERENCE_REGEX = new RegExp(
	`^(?:${Object.keys(namedCharacterReferences).join('|')})`,
)

/** https://html.spec.whatwg.org/multipage/parsing.html#tokenization */
export function tokenize(input: string) {
	let index = 0
	/** https://html.spec.whatwg.org/multipage/parsing.html#current-input-character */
	let currentInputCharacter: string
	/** https://html.spec.whatwg.org/multipage/parsing.html#next-input-character */
	let nextInputCharacter = input[index]
	let isEndOfFile: boolean
	let currentToken: Token
	/** https://html.spec.whatwg.org/multipage/parsing.html#return-state */
	let returnState: State
	let nextFewCharacters = input
	let state: State
	/** https://html.spec.whatwg.org/multipage/parsing.html#temporary-buffer */
	let temporaryBuffer: string
	/** https://html.spec.whatwg.org/multipage/parsing.html#appropriate-end-tag-token */
	let lastEmitedStartTagToken: StartTagToken
	let currentAttribute: Attribute
	/** https://html.spec.whatwg.org/multipage/parsing.html#charref-in-attribute */
	let consumedAsPartOfAttribute: boolean
	/** https://html.spec.whatwg.org/multipage/parsing.html#character-reference-code */
	let characterReferenceCode: number

	/** https://html.spec.whatwg.org/multipage/parsing.html#appropriate-end-tag-token */
	function isAppropriateEndTagToken(endTagToken: EndTagToken) {
		return lastEmitedStartTagToken.tagName === endTagToken.tagName
	}

	function consume(string: string) {
		consumedAsPartOfAttribute =
			returnState === attributeValueDoubleQuotedState ||
			returnState === attributeValueSingleQuotedState ||
			returnState === attributeValueUnquotedState

		isEndOfFile = typeof string === 'undefined'

		if (isEndOfFile) return

		index += string.length
		currentInputCharacter = string.at(-1)!
		nextInputCharacter = input[index]
		nextFewCharacters = input.slice(index)
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#reconsume */
	function reconsumeIn(state: State) {
		index--
		nextInputCharacter = currentInputCharacter

		switchTo(state)
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#flush-code-points-consumed-as-a-character-reference */
	function flushCodePointsConsumedAsCharacterReference() {
		/** https://infra.spec.whatwg.org/#code-point */
		for (const codePoint of temporaryBuffer) {
			if (consumedAsPartOfAttribute) {
				currentAttribute.value += codePoint
			} else {
				emit(new CharacterToken(codePoint))
			}
		}
	}

	function emit(token: Token) {
		if (token instanceof StartTagToken) {
			lastEmitedStartTagToken = token
		}

		console.log(token)
	}

	function switchTo(newState: State) {
		if (state === attributeNameState) {
			const usedNames = new Set<string>()
			const { attributes } = currentToken

			for (const attribute of attributes) {
				const { name } = attribute
				const used = usedNames.has(name)

				usedNames.add(name)

				if (used) {
					attributes.delete(attribute)
				}
			}
		}

		state = newState
	}

	function nextFewCharactersAre(matcher: string | RegExp) {
		if (typeof matcher === 'string')
			return nextFewCharacters.startsWith(matcher)

		return new RegExp(
			`^${matcher.source.replace(/^\^?(?<RegEx>.*?)\$?$/, '$<RegEx>')}`,
		).test(nextFewCharacters)
	}

	//////// STATE ////////

	/** https://html.spec.whatwg.org/multipage/parsing.html#data-state */
	function dataState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '&') {
			returnState = dataState
			switchTo(characterReferenceState)
		} else if (currentInputCharacter === '<') {
			switchTo(tagOpenState)
		} else if (currentInputCharacter === '\0') {
			emit(new CharacterToken(currentInputCharacter))
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			emit(new CharacterToken(currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rcdata-state */
	function RCDATAState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '&') {
			returnState = RCDATAState
			switchTo(characterReferenceState)
		} else if (currentInputCharacter === '<') {
			switchTo(RCDATALessThanSignState)
		} else if (currentInputCharacter === '\0') {
			emit(new CharacterToken('\uFFFD'))
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			emit(new CharacterToken(currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rawtext-state */
	function RAWTEXTState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '<') {
			switchTo(RAWTEXTLessThanSignState)
		} else if (currentInputCharacter === '\0') {
			emit(new CharacterToken('\uFFFD'))
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			emit(new CharacterToken(currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-state */
	function scriptDataState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '<') {
			switchTo(scriptDataLessThanSignState)
		} else if (currentInputCharacter === '\0') {
			emit(new CharacterToken('\uFFFD'))
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			emit(new CharacterToken(currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#plaintext-state */
	function PLAINTEXT() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '\0') {
			emit(new CharacterToken('\uFFFD'))
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			emit(new CharacterToken(currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#tag-open-state */
	function tagOpenState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '!') {
			switchTo(markupDeclarationOpenState)
		} else if (currentInputCharacter === '/') {
			switchTo(endTagOpenState)
		} else if (isASCIIAlpha(currentInputCharacter)) {
			currentToken = new StartTagToken({ tagName: '' })
			reconsumeIn(tagNameState)
		} else if (currentInputCharacter === '?') {
			currentToken = new CommentToken('')
			reconsumeIn(bogusCommentStateState)
		} else if (isEndOfFile) {
			emit(new CharacterToken('<'))
			emit(new EndOfFileToken())
		} else {
			emit(new CharacterToken('<'))
			reconsumeIn(dataState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#end-tag-open-state */
	function endTagOpenState() {
		consume(nextInputCharacter)

		if (isASCIIAlpha(currentInputCharacter)) {
			currentToken = new EndTagToken({ tagName: '' })
			reconsumeIn(tagNameState)
		} else if (currentInputCharacter === '>') {
			switchTo(data)
		} else if (isEndOfFile) {
			emit(new CharacterToken('<'))
			emit(new CharacterToken('/'))
			emit(new EndOfFileToken())
		} else {
			currentToken = new CommentToken('')
			reconsumeIn(bogusCommentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#tag-name-state */
	function tagNameState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
			switchTo(beforeAttributeNameState)
		} else if (currentInputCharacter === '/') {
			switchTo(selfClosingStartTagState)
		} else if (currentInputCharacter === '>') {
			switchTo(dataState) //
			emit(currentToken)
		} else if (isASCIIUpperAlpha(currentInputCharacter)) {
			currentToken.tagName += currentInputCharacter.toLowerCase()
		} else if (currentInputCharacter === '\0') {
			currentToken.tagName += '\uFFFD'
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			currentToken.tagName += currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rcdata-less-than-sign-state */
	function RCDATALessThanSignState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '/') {
			temporaryBuffer = ''
			switchTo(RCDATAEndTagState)
		} else {
			emit(new CharacterToken('\u003C'))
			reconsumeIn(RCDATAState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rcdata-end-tag-open-state */
	function RCDATAEndTagOpenState() {
		consume(nextInputCharacter)

		if (isASCIIAlpha(currentInputCharacter)) {
			currentToken = new EndTagToken({ tagName: '' })
			reconsumeIn(RCDATAEndTagNameState)
		} else {
			emit(new CharacterToken('<'))
			emit(new CharacterToken('/'))
			reconsumeIn(RCDATAState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rcdata-end-tag-name-state */
	function RCDATAEndTagNameState() {
		consume(nextInputCharacter)

		if (
			(currentInputCharacter === '\t' ||
				currentInputCharacter === '\n' ||
				currentInputCharacter === '\f' ||
				currentInputCharacter === ' ') &&
			isAppropriateEndTagToken(currentToken)
		) {
			switchTo(beforeAttributeNameState)
		} else if (
			currentInputCharacter == '/' &&
			isAppropriateEndTagToken(currentToken)
		) {
			switchTo(selfClosingStartTagState)
		} else if (
			currentInputCharacter === '>' &&
			isAppropriateEndTagToken(currentToken)
		) {
			switchTo(dataState)
			emit(currentToken)
		} else if (isASCIIUpperAlpha(currentInputCharacter)) {
			currentToken.tagName += currentInputCharacter.toLowerCase()
			temporaryBuffer += currentInputCharacter
		} else if (isASCIILowerAlpha(currentInputCharacter)) {
			currentToken.tagName += currentInputCharacter
			temporaryBuffer += currentInputCharacter
		} else {
			emit(new CharacterToken('<'))
			emit(new CharacterToken('/'))

			for (const character of temporaryBuffer) {
				emit(new CharacterToken(character))
			}

			reconsumeIn(RCDATAState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rawtext-less-than-sign-state */
	function RAWTEXTLessThanSignState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '/') {
			temporaryBuffer = ''
			switchTo(RAWTEXTEndTagOpenState)
		} else {
			emit(new CharacterToken('<'))
			reconsumeIn(RAWTEXTState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rawtext-end-tag-open-state */
	function RAWTEXTEndTagOpenState() {
		consume(nextInputCharacter)

		if (isASCIIAlpha(currentInputCharacter)) {
			currentToken = new EndTagToken({ tagName: '' })
			reconsumeIn(RAWTEXTEndTagNameState)
		} else {
			emit(new CharacterToken('-'))
			emit(new CharacterToken('/'))
			reconsumeIn(RAWTEXTState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#rawtext-end-tag-name-state */
	function RAWTEXTEndTagNameState() {
		consume(nextFewCharacters)

		if (
			(currentInputCharacter === '\t' ||
				currentInputCharacter === '\n' ||
				currentInputCharacter === '\f' ||
				currentInputCharacter === ' ') &&
			isAppropriateEndTagToken(currentToken)
		) {
			switchTo(beforeAttributeNameState)
		} else if (
			currentInputCharacter === '/' &&
			isAppropriateEndTagToken(currentToken)
		) {
			switchTo(selfClosingStartTagState)
		} else if (
			currentInputCharacter === '>' &&
			isAppropriateEndTagToken(currentToken)
		) {
			switchTo(dataState)
		} else if (isASCIIUpperAlpha(currentInputCharacter)) {
			currentToken.tagName += currentInputCharacter.toLowerCase()
			temporaryBuffer += currentInputCharacter
		} else if (isASCIILowerAlpha(currentInputCharacter)) {
			currentToken.tagName += currentInputCharacter
			temporaryBuffer += currentInputCharacter
		} else {
			emit(new CharacterToken('<'))
			emit(new CharacterToken('/'))

			for (const character of temporaryBuffer) {
				emit(new CharacterToken(character))
			}

			reconsumeIn(RAWTEXTState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-less-than-sign-state */
	function scriptDataLessThanSignState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '/') {
			temporaryBuffer = ''
			switchTo(scriptDataEndTagOpenState)
		} else if (currentInputCharacter === '!') {
			switchTo(scriptDataEscapeStartState)
			emit(new CharacterToken('<'))
			emit(new CharacterToken('!'))
		} else {
			emit(new CharacterToken('<'))
			reconsumeIn(scriptDataState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-end-tag-open-state */
	function scriptDataEndTagOpenState() {
		consume(nextInputCharacter)

		if (isASCIIAlpha(currentInputCharacter)) {
			currentToken = new EndTagToken({ tagName: '' })
			reconsumeIn(scriptDataEndTagNameState)
		} else {
			emit(new CharacterToken('<'))
			emit(new CharacterToken('/'))
			reconsumeIn(scriptDataState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-end-tag-name-state */
	function scriptDataEndTagNameState() {
		consume(nextInputCharacter)

		if (
			(currentInputCharacter === '\t' ||
				currentInputCharacter === '\n' ||
				currentInputCharacter === '\f' ||
				currentInputCharacter === ' ') &&
			isAppropriateEndTagToken(currentToken)
		) {
			switchTo(beforeAttributeNameState)
		} else if (
			currentInputCharacter === '/' &&
			isAppropriateEndTagToken(currentToken)
		) {
			switchTo(selfClosingStartTagState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escape-start-state */
	function scriptDataEscapeStartState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			switchTo(scriptDataEscapeStartDashState)
			emit(new CharacterToken('-'))
		} else {
			reconsumeIn(scriptDataState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escape-start-dash-state */
	function scriptDataEscapeStartDashState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			switchTo(scriptDataEscapedDashDashState)
		} else {
			reconsumeIn(scriptDataState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escaped-state */
	function scriptDataEscapedState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			switchTo(scriptDataEscapedDashState)
			emit(new CharacterToken('-'))
		} else if (currentInputCharacter === '<') {
			switchTo(scriptDataEscapedLessThanSignState)
		} else if (currentInputCharacter === '\0') {
			emit(new CharacterToken('\uFFFD'))
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			emit(currentInputCharacter)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escaped-dash-state */
	function scriptDataEscapedDashState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			switchTo(scriptDataEscapedDashDashState)
			emit(new CharacterToken('-'))
		} else if (currentInputCharacter === '<') {
			switchTo(scriptDataEscapedLessThanSignState)
		} else if (currentInputCharacter === '\0') {
			switchTo(scriptDataEscapedState)
			emit(new CharacterToken('\uFFFD'))
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			switchTo(scriptDataEscapedState)
			emit(new CharacterToken(currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escaped-dash-dash-state */
	function scriptDataEscapedDashDashState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			emit(new CharacterToken('-'))
		} else if (currentInputCharacter === '<') {
			switchTo(scriptDataEscapedLessThanSignState)
		} else if (currentInputCharacter === '>') {
			switchTo(scriptDataState)
			emit(new CharacterToken('>'))
		} else if (currentInputCharacter === '\0') {
			switchTo(scriptDataState)
			emit(new CharacterToken('\uFFFD'))
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			switchTo(scriptDataEscapedState)
			emit(new CharacterToken(currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escaped-less-than-sign-state */
	function scriptDataEscapedLessThanSignState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '/') {
			temporaryBuffer = ''
			switchTo(scriptDataEscapedEndTagOpenState)
		} else if (isASCIIAlpha(currentInputCharacter)) {
			temporaryBuffer = ''
			emit(new CharacterToken('<'))
			reconsumeIn(scriptDataDoubleEscapeStartState)
		} else {
			emit(new CharacterToken('<'))
			reconsumeIn(scriptDataState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escaped-end-tag-open-state */
	function scriptDataEscapedEndTagOpenState() {
		consume(nextInputCharacter)

		if (isASCIIAlpha(currentInputCharacter)) {
			currentToken = new EndTagToken({ tagName: '' })
			reconsumeIn(scriptDataEscapedEndTagNameState)
		} else {
			emit(new CharacterToken('<'))
			emit(new CharacterToken('/'))
			reconsumeIn(scriptDataEscapedState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-escaped-end-tag-name-state */
	function scriptDataEscapedEndTagNameState() {
		consume(nextInputCharacter)

		if (
			(currentInputCharacter === '\t' ||
				currentInputCharacter === '\n' ||
				currentInputCharacter === '\f' ||
				currentInputCharacter === ' ') &&
			isAppropriateEndTagToken(currentToken)
		) {
			switchTo(beforeAttributeNameState)
		} else if (
			currentInputCharacter === '/' &&
			isAppropriateEndTagToken(currentToken)
		) {
			switchTo(selfClosingStartTagState)
		} else if (
			currentInputCharacter === '>' &&
			isAppropriateEndTagToken(currentToken)
		) {
			switchTo(dataState)
			emit(currentToken)
		} else if (isASCIIUpperAlpha(currentInputCharacter)) {
			currentToken.tagName += currentInputCharacter.toLowerCase()
			temporaryBuffer += currentInputCharacter.toLowerCase()
		} else if (isASCIILowerAlpha(currentInputCharacter)) {
			currentToken.tagName += currentInputCharacter
			temporaryBuffer += currentInputCharacter
		} else {
			emit(new CharacterToken('<'))
			emit(new CharacterToken('/'))

			for (const character of temporaryBuffer) {
				emit(new CharacterToken(character))
			}

			reconsumeIn(scriptDataEscapedState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escape-start-state */
	function scriptDataDoubleEscapeStartState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
			if (temporaryBuffer === 'script') {
				switchTo(scriptDataDoubleEscapedState)
			} else {
				switchTo(scriptDataEscapedState)
			}

			emit(new CharacterToken(currentInputCharacter))
		} else if (isASCIIUpperAlpha(currentInputCharacter)) {
			temporaryBuffer += currentInputCharacter.toLowerCase()
			emit(new CharacterToken(currentInputCharacter))
		} else if (isASCIILowerAlpha(currentInputCharacter)) {
			temporaryBuffer += currentInputCharacter
			emit(new CharacterToken(currentInputCharacter))
		} else {
			reconsumeIn(scriptDataEscapedState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escaped-state */
	function scriptDataDoubleEscapedState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			switchTo(scriptDataDoubleEscapedDashState)
			emit(new CharacterToken('-'))
		} else if (currentInputCharacter === '<') {
			switchTo(scriptDataDoubleEscapedLessThanSignState)
			emit(new CharacterToken('<'))
		} else if (currentInputCharacter === '\0') {
			emit(new CharacterToken('\uFFFD'))
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			emit(new CharacterToken(currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escaped-dash-state */
	function scriptDataDoubleEscapedDashState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			switchTo(scriptDataDoubleEscapedDashDashState)
			emit(new CharacterToken('-'))
		} else if (currentInputCharacter === '<') {
			switchTo(scriptDataDoubleEscapedLessThanSignState)
			emit(new CharacterToken('<'))
		} else if (currentInputCharacter === '\0') {
			switchTo(scriptDataState)
			emit(new CharacterToken('\uFFFD'))
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			switchTo(scriptDataDoubleEscapedState)
			emit(new CharacterToken(currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escaped-dash-dash-state */
	function scriptDataDoubleEscapedDashDashState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			emit(new CharacterToken('-'))
		} else if (currentInputCharacter === '<') {
			switchTo(scriptDataDoubleEscapedLessThanSignState)
			emit(new CharacterToken('<'))
		} else if (currentInputCharacter === '>') {
			switchTo(scriptDataState)
			emit(new CharacterToken('>'))
		} else if (currentInputCharacter === '\0') {
			switchTo(scriptDataState)
			emit(new CharacterToken('\uFFFD'))
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			switchTo(scriptDataDoubleEscapedState)
			emit(new CharacterToken(currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escaped-less-than-sign-state */
	function scriptDataDoubleEscapedLessThanSignState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '/') {
			temporaryBuffer = ''
			switchTo(scriptDataDoubleEscapeEndState)
			emit(new CharacterToken('/'))
		} else {
			reconsumeIn(scriptDataEscapedState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escape-end-state */
	function scriptDataDoubleEscapeEndState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
			if (temporaryBuffer === 'script') {
				switchTo(scriptDataEscapedState)
			} else {
				switchTo(scriptDataDoubleEscapedState)
			}

			emit(new CharacterToken(currentInputCharacter))
		} else if (isASCIIUpperAlpha(currentInputCharacter)) {
			currentToken.tagName += currentInputCharacter.toLowerCase()
			emit(new CharacterToken(currentInputCharacter))
		} else if (isASCIILowerAlpha(currentInputCharacter)) {
			currentToken.tagName += currentInputCharacter
			emit(new CharacterToken(currentInputCharacter))
		} else {
			reconsumeIn(scriptDataDoubleEscapedState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#before-attribute-name-state */
	function beforeAttributeNameState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
		} else if (
			currentInputCharacter === '/' ||
			currentInputCharacter === '>' ||
			isEndOfFile
		) {
			reconsumeIn(afterAttributeNameState)
		} else if (currentInputCharacter === '=') {
			currentAttribute = new Attribute({
				name: currentInputCharacter,
				value: '',
			})

			currentToken.attributes.add(currentAttribute)
			switchTo(attributeNameState)
		} else {
			currentAttribute = new Attribute({ name: '', value: '' })
			currentToken.attributes.add(currentAttribute)
			reconsumeIn(attributeNameState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#attribute-name-state */
	function attributeNameState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' ' ||
			currentInputCharacter === '/' ||
			currentInputCharacter === '>' ||
			isEndOfFile
		) {
			reconsumeIn(afterAttributeNameState)
		} else if (currentInputCharacter === '=') {
			switchTo(beforeAttributeValueState)
		} else if (isASCIIAlpha(currentInputCharacter)) {
			currentAttribute.name += currentInputCharacter.toLowerCase()
		} else {
			currentAttribute.name += currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#after-attribute-name-state */
	function afterAttributeNameState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
		} else if (currentInputCharacter === '/') {
			switchTo(selfClosingStartTagState)
		} else if (currentInputCharacter === '=') {
			switchTo(beforeAttributeValueState)
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			currentAttribute = new Attribute({ name: '', value: '' })
			currentToken.attributes.add(currentAttribute)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#before-attribute-value-state */
	function beforeAttributeValueState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
		} else if (currentInputCharacter === '"') {
			switchTo(attributeValueDoubleQuotedState)
		} else if (currentInputCharacter === "'") {
			switchTo(attributeValueSingleQuotedState)
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else {
			reconsumeIn(attributeValueUnquotedState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(double-quoted)-state */
	function attributeValueDoubleQuotedState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '"') {
			switchTo(afterAttributeValueQuotedState)
		} else if (currentInputCharacter === '&') {
			returnState = attributeValueDoubleQuotedState
			switchTo(characterReferenceState)
		} else if (currentInputCharacter === '\0') {
			currentAttribute.value += '\uFFFD'
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			currentAttribute.value += currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(single-quoted)-state */
	function attributeValueSingleQuotedState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === "'") {
			switchTo(afterAttributeValueQuotedState)
		} else if (currentInputCharacter === '&') {
			returnState = attributeValueSingleQuotedState
			switchTo(characterReferenceState)
		} else if (currentInputCharacter === '\0') {
			currentAttribute.value += '\uFFFD'
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			currentAttribute.value += currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(unquoted)-state */
	function attributeValueUnquotedState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
			switchTo(beforeAttributeNameState)
		} else if (currentInputCharacter === '&') {
			returnState = attributeValueUnquotedState
			switchTo(characterReferenceState)
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
		} else if (currentInputCharacter === '\0') {
			currentAttribute.name += '\uFFFD'
		} else if (currentInputCharacter === '') {
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#after-attribute-value-(quoted)-state */
	function afterAttributeValueQuotedState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
			switchTo(beforeAttributeNameState)
		} else if (currentInputCharacter === '/') {
			switchTo(selfClosingStartTagState)
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			reconsumeIn(beforeAttributeNameState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#self-closing-start-tag-state */
	function selfClosingStartTagState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '>') {
			currentToken.selfClosingFlag = true
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			reconsumeIn(beforeAttributeNameState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#bogus-comment-state */
	function bogusCommentState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			emit(currentToken)
			emit(new EndOfFileToken())
		} else if (currentInputCharacter === '\0') {
			currentToken.data += currentInputCharacter
		} else {
			currentToken.data += currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#markup-declaration-open-state */
	function markupDeclarationOpenState() {
		if (nextFewCharactersAre('--')) {
			consume('--')
			currentToken = new CommentToken()
			switchTo(commentStartState)
		} else if (nextFewCharactersAre(ASCIICaseInsensitive('DOCTYPE'))) {
			// TODO Should consume matched characters.
			consume('DOCTYPE')
			switchTo(DOCTYPEState)
		} else if (nextFewCharactersAre(`[CDATA[`)) {
			// TODO
			consume('[CDATA[')

			if (adjustedCurrentNode) {
				switchTo(CDATASectionState)
			} else {
				currentToken = new CommentToken('[CDATA[')
				switchTo(bogusCommentState)
			}
		} else {
			currentToken = new CommentToken()
			switchTo(bogusCommentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-start-state */
	function commentStartState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			switchTo(commentStartDashState)
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else {
			reconsumeIn(commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-start-dash-state */
	function commentStartDashState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			switchTo(commentEndState)
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.data += '-'
			reconsumeIn(commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-state */
	function commentState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '<') {
			currentToken.data += currentInputCharacter
			switchTo(commentLessThanSignState)
		} else if (currentInputCharacter === '-') {
			switchTo(commentEndDashState)
		} else if (currentInputCharacter === '\0') {
			currentToken.data += '\uFFFD'
		} else if (isEndOfFile) {
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.data += currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-less-than-sign-state */
	function commentLessThanSignState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '!') {
			currentToken.data += currentInputCharacter
			switchTo(commentLessThanSignBangState)
		} else if (currentInputCharacter === '<') {
			currentToken.data += currentInputCharacter
		} else {
			reconsumeIn(commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-less-than-sign-bang-state */
	function commentLessThanSignBangState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			switchTo(commentLessThanSignBangDashState)
		} else {
			reconsumeIn(commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-less-than-sign-bang-dash-state */
	function commentLessThanSignBangDashState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			switchTo(commentLessThanSignBangDashDashState)
		} else {
			reconsumeIn(commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-less-than-sign-bang-dash-dash-state */
	function commentLessThanSignBangDashDashState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '>' || isEndOfFile) {
			reconsumeIn(commentEndState)
		} else {
			reconsumeIn(commentEndState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-end-dash-state */
	function commentEndDashState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			switchTo(commentEndState)
		} else if (isEndOfFile) {
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.data += '-'
			reconsumeIn(commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-end-state */
	function commentEndState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else if (currentInputCharacter === '!') {
			switchTo(commentEndBangState)
		} else if (currentInputCharacter === '-') {
			currentToken.data += '-'
		} else if (isEndOfFile) {
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.data += '--'
			reconsumeIn(commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#comment-end-bang-state */
	function commentEndBangState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '-') {
			currentToken.data += '-!'
			switchTo(commentEndDashState)
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.data += '--!'
			reconsumeIn(commentState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#doctype-state */
	function DOCTYPEState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
			switchTo(beforeDOCTYPENameState)
		} else if (currentInputCharacter === '>') {
			reconsumeIn(beforeDOCTYPENameState)
		} else if (isEndOfFile) {
			currentToken = new DOCTYPEToken({ forceQuirksFlag: true })
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			reconsumeIn(beforeDOCTYPENameState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#before-doctype-name-state */
	function beforeDOCTYPENameState() {
		consume(nextInputCharacter)
		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
		} else if (isASCIIUpperAlpha(currentInputCharacter)) {
			currentToken = new DOCTYPEToken({
				name: currentInputCharacter.toLowerCase(),
			})

			switchTo(DOCTYPENameState)
		} else if (currentInputCharacter === '\0') {
			currentToken = new DOCTYPEToken({ name: '\uFFFD' })
			switchTo(DOCTYPENameState)
		} else if (currentInputCharacter === '>') {
			currentToken = new DOCTYPEToken({
				forceQuirks: true,
			})

			switchTo(DOCTYPENameState)
			emit(currentToken)
		} else if (isEndOfFile) {
			currentToken = new DOCTYPEToken({ forceQuirksFlag: true })
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken = new DOCTYPEToken({ name: currentInputCharacter })
			switchTo(DOCTYPENameState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#doctype-name-state */
	function DOCTYPENameState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
			switchTo(afterDOCTYPENameState)
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else if (isASCIIUpperAlpha(currentInputCharacter)) {
			currentToken.name += currentInputCharacter.toLowerCase()
		} else if (currentInputCharacter === '\0') {
			currentToken.name += '\uFFFD'
		} else if (isEndOfFile) {
			currentToken.forceQuirksFlag = true
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.name += currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#after-doctype-name-state */
	function afterDOCTYPENameState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			currentToken.forceQuirksFlag = true
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			const sixCharactersStartingFromCurrentInputCharacter = input.slice(
				index - 1,
				index + 5,
			)

			if (
				ASCIICaseInsensitive('PUBLIC').test(
					sixCharactersStartingFromCurrentInputCharacter,
				)
			) {
				consume(sixCharactersStartingFromCurrentInputCharacter)
				switchTo(afterDOCTYPEPublicKeywordState)
			} else if (
				ASCIICaseInsensitive('SYSTEM').test(
					sixCharactersStartingFromCurrentInputCharacter,
				)
			) {
				consume(sixCharactersStartingFromCurrentInputCharacter)
				switchTo(afterDOCTYPESystemKeywordState)
			} else {
				currentToken.forceQuirksFlag = true
				reconsumeIn(bogusCommentState)
			}
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#after-doctype-public-keyword-state */
	function afterDOCTYPEPublicKeywordState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
			switchTo(beforeDOCTYPEPublicIdentifierState)
		} else if (currentInputCharacter === '"') {
			currentToken.publicIdentifier = ''
			switchTo(DOCTYPEPublicIdentifierDoubleQuotedState)
		} else if (currentInputCharacter === '>') {
			currentToken.forceQuirksFlag = true
			switchTo(dataState)
			emit(new EndOfFileToken())
		} else {
			currentToken.forceQuirksFlag = true
			reconsumeIn(bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#before-doctype-public-identifier-state */
	function beforeDOCTYPEPublicIdentifierState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
		} else if (currentInputCharacter === '"') {
			currentToken.publicIdentifier = ''
			switchTo(DOCTYPEPublicIdentifierDoubleQuotedState)
		} else if (currentInputCharacter === "'") {
			currentToken.publicIdentifier = ''
			switchTo(DOCTYPEPublicIdentifierSingleQuotedState)
		} else if (currentInputCharacter === '>') {
			currentToken.forceQuirksFlag = true
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			currentToken.forceQuirksFlag = true
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.forceQuirksFlag = true
			reconsumeIn(bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#doctype-public-identifier-(double-quoted)-state */
	function DOCTYPEPublicIdentifierDoubleQuotedState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '"') {
			switchTo(afterDOCTYPEPublicIdentifierState)
		} else if (currentInputCharacter === '\0') {
			currentToken.publicIdentifier += '\uFFFD'
		} else if (currentInputCharacter === '>') {
			currentToken.forceQuirksFlag = true
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			currentToken.forceQuirksFlag = true
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.publicIdentifier += currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#doctype-public-identifier-(single-quoted)-state */
	function DOCTYPEPublicIdentifierSingleQuotedState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === "'") {
			switchTo(afterDOCTYPEPublicIdentifierState)
		} else if (currentInputCharacter === '\0') {
			currentToken.publicIdentifier += '\uFFFD'
		} else if (currentInputCharacter === '>') {
			currentToken.forceQuirksFlag = true
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			currentToken.forceQuirksFlag = true
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.publicIdentifier += currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#after-doctype-public-identifier-state */
	function afterDOCTYPEPublicIdentifierState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
			switchTo(betweenDOCTYPEPublicAndSystemIdentifierState)
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else if (currentInputCharacter === '"') {
			currentToken.systemIdentifier = ''
			switchTo(DOCTYPESystemIdentifierDoubleQuotedState)
		} else if (currentInputCharacter === "'") {
			currentToken.systemIdentifier = ''
			switchTo(DOCTYPESystemIdentifierSingleQuotedState)
		} else if (isEndOfFile) {
			currentToken.forceQuirksFlag = true
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.forceQuirksFlag = true
			reconsumeIn(bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#between-doctype-public-and-system-identifiers-state */
	function betweenDOCTYPEPublicAndSystemIdentifierState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else if (currentInputCharacter === '"') {
			currentToken.systemIdentifier = ''
			switchTo(DOCTYPESystemIdentifierDoubleQuotedState)
		} else if (currentInputCharacter === "'") {
			currentToken.systemIdentifier = ''
			switchTo(DOCTYPESystemIdentifierSingleQuotedState)
		} else if (isEndOfFile) {
			currentToken.forceQuirksFlag = true
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.forceQuirksFlag = true
			reconsumeIn(bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#before-doctype-system-identifier-state */
	function afterDOCTYPESystemKeywordState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
			switchTo(beforeDOCTYPESystemIdentifierState)
		} else if (currentInputCharacter === '"') {
			currentToken.systemIdentifier = ''
			switchTo(DOCTYPESystemIdentifierDoubleQuotedState)
		} else if (currentInputCharacter === '>') {
			currentToken.forceQuirksFlag = true
			switchTo(dataState)
			emit(new EndOfFileToken())
		} else {
			currentToken.forceQuirksFlag = true
			reconsumeIn(bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#before-doctype-system-identifier-state */
	function beforeDOCTYPESystemIdentifierState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
		} else if (currentInputCharacter === '"') {
			currentToken.systemIdentifier = ''
			switchTo(DOCTYPESystemIdentifierDoubleQuotedState)
		} else if (currentInputCharacter === "'") {
			currentToken.systemIdentifier = ''
			switchTo(DOCTYPESystemIdentifierSingleQuotedState)
		} else if (currentInputCharacter === '>') {
			currentToken.forceQuirksFlag = true
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			currentToken.forceQuirksFlag = true
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.forceQuirksFlag = true
			reconsumeIn(bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#doctype-system-identifier-(double-quoted)-state */
	function DOCTYPESystemIdentifierDoubleQuotedState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '"') {
			switchTo(afterDOCTYPESystemIdentifierState)
		} else if (currentInputCharacter === '\0') {
			currentToken.systemIdentifier += '\uFFFD'
		} else if (currentInputCharacter === '>') {
			currentToken.forceQuirksFlag = true
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			currentToken.forceQuirksFlag = true
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.systemIdentifier += currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#doctype-system-identifier-(single-quoted)-state */
	function DOCTYPESystemIdentifierSingleQuotedState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === "'") {
			switchTo(afterDOCTYPESystemIdentifierState)
		} else if (currentInputCharacter === '\0') {
			currentToken.systemIdentifier += '\uFFFD'
		} else if (currentInputCharacter === '>') {
			currentToken.forceQuirksFlag = true
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			currentToken.forceQuirksFlag = true
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			currentToken.systemIdentifier += currentInputCharacter
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#after-doctype-system-identifier-state */
	function afterDOCTYPESystemIdentifierState() {
		consume(nextInputCharacter)

		if (
			currentInputCharacter === '\t' ||
			currentInputCharacter === '\n' ||
			currentInputCharacter === '\f' ||
			currentInputCharacter === ' '
		) {
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else if (isEndOfFile) {
			currentToken.forceQuirksFlag = true
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
			reconsumeIn(bogusDOCTYPEState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#bogus-doctype-state */
	function bogusDOCTYPEState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === '>') {
			switchTo(dataState)
			emit(currentToken)
		} else if (currentInputCharacter === '\0') {
		} else if (isEndOfFile) {
			emit(currentToken)
			emit(new EndOfFileToken())
		} else {
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#cdata-section-state */
	function CDATASectionState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === ']') {
			switchTo(CDATASectionBracketState)
		} else if (isEndOfFile) {
			emit(new EndOfFileToken())
		} else {
			emit(new CharacterToken(currentInputCharacter))
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#cdata-section-bracket-state */
	function CDATASectionBracketState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === ']') {
			switchTo(CDATASectionEndState)
		} else {
			emit(new CharacterToken(']'))
			reconsumeIn(CDATASectionState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#cdata-section-end-state */
	function CDATASectionEndState() {
		consume(nextInputCharacter)

		if (currentInputCharacter === ']') {
			emit(new CharacterToken(']'))
		} else if (currentInputCharacter === '>') {
			switchTo(dataState)
		} else {
			emit(new CharacterToken(']'))
			emit(new CharacterToken(']'))
			reconsumeIn(CDATASectionState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#character-reference-state */
	function characterReferenceState() {
		temporaryBuffer = ''
		temporaryBuffer += '&'
		consume(nextInputCharacter)

		if (isASCIIAlphanumeric(currentInputCharacter)) {
			reconsumeIn(namedCharacterReferenceState)
		} else if (currentInputCharacter === '#') {
			temporaryBuffer += currentInputCharacter
			switchTo(numericCharacterReferenceState)
		} else {
			flushCodePointsConsumedAsCharacterReference()
			reconsumeIn(returnState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#named-character-reference-state */
	function namedCharacterReferenceState() {
		const maximumNumberOfCharactersPossible: keyof typeof namedCharacterReferences =
			input.slice(index).match(NAMED_CHARACTER_REFERENCE_REGEX)?.[0] ?? ''

		consume(maximumNumberOfCharactersPossible)
		temporaryBuffer += maximumNumberOfCharactersPossible

		if (maximumNumberOfCharactersPossible) {
			if (
				consumedAsPartOfAttribute &&
				maximumNumberOfCharactersPossible.at(-1) !== ';' &&
				(nextInputCharacter === '=' ||
					isASCIIAlphanumeric(nextInputCharacter))
			) {
				flushCodePointsConsumedAsCharacterReference()
				switchTo(returnState)
			} else {
				if (maximumNumberOfCharactersPossible.at(-1) === ';') {
				}

				temporaryBuffer = ''
				temporaryBuffer +=
					namedCharacterReferences[maximumNumberOfCharactersPossible]
				flushCodePointsConsumedAsCharacterReference()
				switchTo(returnState)
			}
		} else {
			flushCodePointsConsumedAsCharacterReference()
			switchTo(ambiguousAmpersandState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#ambiguous-ampersand-state */
	function ambiguousAmpersandState() {
		consume(nextInputCharacter)

		if (isASCIIAlphanumeric(currentInputCharacter)) {
			if (consumedAsPartOfAttribute) {
				currentAttribute.value += currentInputCharacter
			} else {
				emit(new CharacterToken(currentInputCharacter))
			}
		} else if (currentInputCharacter === ';') {
			reconsumeIn(returnState)
		} else {
			reconsumeIn(returnState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-state */
	function numericCharacterReferenceState() {
		characterReferenceCode = 0

		consume(nextInputCharacter)

		if (currentInputCharacter === 'x' || currentInputCharacter === 'X') {
			temporaryBuffer += currentInputCharacter
			switchTo(hexadecimalCharacterReferenceStartState)
		} else {
			reconsumeIn(decimalCharacterReferenceStartState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#hexadecimal-character-reference-start-state */
	function hexadecimalCharacterReferenceStartState() {
		consume(nextInputCharacter)

		if (isASCIIHexDigit(currentInputCharacter)) {
			reconsumeIn(hexadecimalCharacterReferenceState)
		} else {
			flushCodePointsConsumedAsCharacterReference()
			reconsumeIn(returnState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#decimal-character-reference-start-state */
	function decimalCharacterReferenceStartState() {
		consume(nextInputCharacter)

		if (isASCIIDigit(currentInputCharacter)) {
			reconsumeIn(decimalCharacterReferenceState)
		} else {
			flushCodePointsConsumedAsCharacterReference()
			reconsumeIn(returnState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#hexadecimal-character-reference-state */
	function hexadecimalCharacterReferenceState() {
		consume(nextInputCharacter)

		if (isASCIIDigit(currentInputCharacter)) {
			characterReferenceCode *= 16
			characterReferenceCode +=
				currentInputCharacter.charCodeAt(0) - 0x0030
		} else if (isASCIIUpperHexDigit(currentInputCharacter)) {
			characterReferenceCode *= 16
			characterReferenceCode +=
				currentInputCharacter.charCodeAt(0) - 0x0037
		} else if (isASCIILowerHexDigit(currentInputCharacter)) {
			characterReferenceCode *= 16
			characterReferenceCode +=
				currentInputCharacter.charCodeAt(0) - 0x0057
		} else if (currentInputCharacter === ';') {
			switchTo(numericCharacterReferenceEndState)
		} else {
			reconsumeIn(numericCharacterReferenceEndState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#decimal-character-reference-state */
	function decimalCharacterReferenceState() {
		consume(nextInputCharacter)

		if (isASCIIDigit(currentInputCharacter)) {
			characterReferenceCode *= 10
			characterReferenceCode +=
				currentInputCharacter.charCodeAt(0) - 0x0030
		} else if (currentInputCharacter === ';') {
			switchTo(numericCharacterReferenceEndState)
		} else {
			reconsumeIn(numericCharacterReferenceEndState)
		}
	}

	/** https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-end-state */
	function numericCharacterReferenceEndState() {
		if (characterReferenceCode === 0x00) {
			characterReferenceCode = 0xfffd
		} else if (characterReferenceCode > 0x10ffff) {
			characterReferenceCode = 0xfffd
		} else if (isSurrogate(characterReferenceCode)) {
			characterReferenceCode = 0xfffd
		} else if (isNoncharacter(characterReferenceCode)) {
		} else if (
			characterReferenceCode === 0x0d ||
			(isControl(characterReferenceCode) &&
				!isASCIIWhitespace(characterReferenceCode))
		) {
		}

		const table = new Map({
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
		})

		if (table.has(characterReferenceCode)) {
			characterReferenceCode = table.get(characterReferenceCode)
		}

		temporaryBuffer = ''
		temporaryBuffer += String.fromCodePoint(characterReferenceCode)
		flushCodePointsConsumedAsCharacterReference()
		switchTo(returnState)
	}

	const initialState = dataState
	state = initialState

	while (!isEndOfFile) {
		state()
	}
}

tokenize(
	String.raw`<!DOCTYPE html>
<html lang="en">
	<!-- Look a comment -->

	<br/> <-- Self closing!

	<p>&amp</p>

	&amp
</html>`,
)
