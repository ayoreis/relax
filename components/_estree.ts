import type { SWCTypes } from './_dependencies.ts'

import { SWC } from './_dependencies.ts'

const SWC_PARSE_OPTIONS: SWCTypes.ParseOptions = {
	syntax: 'typescript',
	tsx: true,
	decorators: false,
	dynamicImport: true,
	comments: true,
	script: false,
	target: 'es2022',
}

const SWC_PRINT_OPTIONS: SWCTypes.Config = {}

const span: SWCTypes.Span = { start: 0, end: 0, ctxt: 0 }

let accumulatedSpan = 0

/**
 * https://github.com/swc-project/swc/issues/1366
 * https://github.com/littledivy/deno_swc/issues/39
 */
export function normalizeSpan(span: SWCTypes.Span): SWCTypes.Span {
	return {
		start: span.start - accumulatedSpan,
		end: span.end - accumulatedSpan,
		ctxt: span.ctxt,
	}
}

export function createModule(): SWCTypes.Module {
	return {
		body: [],
		// @ts-ignore It works
		interpreter: null,
		span,
		type: 'Module',
	}
}

export function parse(source: string) {
	const parsed = SWC.parse(source, SWC_PARSE_OPTIONS)

	accumulatedSpan = parsed.span.end

	return parsed
}

export function print(module: SWCTypes.Module) {
	return SWC.print(module, SWC_PRINT_OPTIONS).code
}
