/** https://infra.spec.whatwg.org/#code-point */
export type CodePoint = string | number

/** https://infra.spec.whatwg.org/#surrogate */
export function isSurrogate(codePoint: CodePoint) {
	return /^[\uD800-\uDFFF]$/.test(codePoint.toString())
}

/** https://infra.spec.whatwg.org/#noncharacter */
export function isNoncharacter(codePoint: CodePoint) {
	return /^[\uFDD0-\uFDEF]|\uFFFE|\uFFFF|\u{1FFFE}|\u{1FFFF}|\u{2FFFE}|\u{2FFFF}|\u{3FFFE}|\u{3FFFF}|\u{4FFFE}|\u{4FFFF}|\u{5FFFE}|\u{5FFFF}|\u{6FFFE}|\u{6FFFF}|\u{7FFFE}|\u{7FFFF}|\u{8FFFE}|\u{8FFFF}|\u{9FFFE}|\u{9FFFF}|\u{AFFFE}|\u{AFFFF}|\u{BFFFE}|\u{BFFFF}|\u{CFFFE}|\u{CFFFF}|\u{DFFFE}|\u{DFFFF}|\u{EFFFE}|\u{EFFFF}|\u{FFFFE}|\u{FFFFF}|\u{10FFFE}|\u{10FFFF}$/u.test(
		codePoint.toString(),
	)
}

/** https://infra.spec.whatwg.org/#ascii-code-point */
export function isASCIICodePoint(codePoint: CodePoint) {
	// deno-lint-ignore no-control-regex
	return /^[\u0000-\u007F]$/.test(codePoint.toString())
}

/** https://infra.spec.whatwg.org/#ascii-whitespace */
export function isASCIIWhitespace(codePoint: CodePoint) {
	return ['\u0009', '\u000A', '\u000C', '\u000D', '\u0020'].includes(
		codePoint.toString(),
	)
}

/** https://infra.spec.whatwg.org/#c0-control */
export function isC0Control(codePoint: CodePoint) {
	return /^[\u0000-\u001F]$/.test(codePoint.toString())
}

/** https://infra.spec.whatwg.org/#control */
export function isControl(codePoint: CodePoint) {
	return (
		isC0Control(codePoint) || /^[\u007F-\u009F]$/.test(codePoint.toString())
	)
}

/** https://infra.spec.whatwg.org/#ascii-upper-hex-digit */
export function isASCIIDigit(codePoint: CodePoint) {
	return /^[\u0030-\u0039]$/.test(codePoint.toString())
}

/** https://infra.spec.whatwg.org/#ascii-upper-hex-digit */
export function isASCIIUpperHexDigit(codePoint: CodePoint) {
	return /^[\u0041-\u0046]]$/.test(codePoint.toString())
}

/** https://infra.spec.whatwg.org/#ascii-upper-hex-digit */
export function isASCIILowerHexDigit(codePoint: CodePoint) {
	return /^[\u0061-\u0066]$/.test(codePoint.toString())
}

/** https://infra.spec.whatwg.org/#ascii-hex-digit */
export function isASCIIHexDigit(codePoint: CodePoint) {
	return isASCIIUpperHexDigit(codePoint) || isASCIILowerHexDigit(codePoint)
}

/** https://infra.spec.whatwg.org/#ascii-upper-alpha */
export function isASCIIUpperAlpha(codePoint: CodePoint) {
	return /^[\u0041-\u005A]$/.test(codePoint.toString())
}

/** https://infra.spec.whatwg.org/#ascii-lower-alpha */
export function isASCIILowerAlpha(codePoint: CodePoint) {
	return /^[\u0061-\u007A]$/.test(codePoint.toString())
}

/** https://infra.spec.whatwg.org/#ascii-alpha */
export function isASCIIAlpha(codePoint: CodePoint) {
	return isASCIIUpperAlpha(codePoint) || isASCIILowerAlpha(codePoint)
}

/** https://infra.spec.whatwg.org/#ascii-alphanumeric */
export function isASCIIAlphanumeric(codePoint: CodePoint) {
	return isASCIIDigit(codePoint) || isASCIIAlpha(codePoint)
}

/** https://infra.spec.whatwg.org/#ascii-string */
export function isASCIIString(string: string) {
	return string.split('').every(isASCIICodePoint)
}

/** https://infra.spec.whatwg.org/#ascii-case-insensitive */
export function ASCIICaseInsensitive(A: string) {
	if (!isASCIIString(A)) return /(?!)/
	return new RegExp(`^${A}$`, 'i')
}
