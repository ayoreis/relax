import { BLANK_LINE, LINE_ENDING } from './preliminaries.ts';

export type ContainerBlockKind = Document;
export type LeafBlockKind = ThematicBreak | Paragraph | BlankLine;
export type BlockKind = ContainerBlockKind | LeafBlockKind;

type ATXHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type SetextHeadingLevel = 1 | 2;

/** 3. https://spec.commonmark.org/0.30/#blocks */
export abstract class Block {
	open = true;

	// @ts-expect-error https://github.com/microsoft/TypeScript/issues/34516
	static start(_line: string): null | readonly [Block, number] {}
	abstract continue(_line: string): null | number;
	abstract close(): void;
}

/** 4. https://spec.commonmark.org/0.30/#leaf-blocks */
export abstract class LeafBlock extends Block {
}

/** 4.1. https://spec.commonmark.org/0.30/#thematic-breaks */
export class ThematicBreak extends LeafBlock {
	static readonly #THEMATIC_BREAK =
		/^ {0,3}(?<type>[-_*])(?:[ \t]*\k<type>){2,}[ \t]*\r?\n?$/;

	static start(line: string) {
		return this.#THEMATIC_BREAK.test(line)
			? [new this(), line.length] as const
			: null;
	}

	continue() {
		return null;
	}

	close() {
		this.open = false;
	}
}

/** 4.2 https://spec.commonmark.org/0.30/#atx-headings */
export class ATXHeading extends LeafBlock {
	static #ATX_HEADING = /^ {0,3}(?<level>#{1,6})(?:[ \t]+|$)/d;
	// TODO
	rawContents = '';

	private constructor(readonly level: ATXHeadingLevel) {
		super();
	}

	static start(line: string) {
		const match = line.match(this.#ATX_HEADING);

		if (!match) return null;

		return [
			new this(match.groups!.level!.length as ATXHeadingLevel),
			match.indices![0]![1],
		] as const;
	}

	continue() {
		return null;
	}

	close() {
		this.open = false;
	}
}

/** 4.3. https://spec.commonmark.org/0.30/#setext-headings */
export class SetextHeading extends LeafBlock {
	/** https://spec.commonmark.org/0.30/#setext-heading-underline */
	static #SETEXT_HEADING_UNDERLINE = /^ {0,3}(?<type>[-=]){1,}[ \t]*\n?\r?$/;

	linesOfText = '';

	private constructor(readonly level: SetextHeadingLevel) {
		super();
	}

	static start(line: string) {
		const match = line.match(this.#SETEXT_HEADING_UNDERLINE);

		return match
			? [
				new SetextHeading(match.groups!.type! === '=' ? 1 : 2),
				line.length,
			] as const
			: null;
	}

	continue() {
		return null;
	}

	close(): void {
		this.open = false;
	}
}

/** 4.8. https://spec.commonmark.org/0.30/#paragraphs */
export class Paragraph extends LeafBlock {
	// TODO
	rawContent = '';

	static start(line: string) {
		return BLANK_LINE.test(line) ? null : [new Paragraph(), 0] as const;
	}

	continue(line: string) {
		return BLANK_LINE.test(line) ? null : 0;
	}

	close(): void {
		this.open = false;
	}
}

/** 4.9. https://spec.commonmark.org/0.30/#blank-lines */
export class BlankLine extends LeafBlock {
	static start(line: string) {
		return BLANK_LINE.test(line)
			? [new BlankLine(), line.length] as const
			: null;
	}

	continue() {
		return null;
	}

	close(): void {
		this.open = false;
	}
}

/** 5.  https://spec.commonmark.org/0.30/#container-blocks */
export abstract class ContainerBlock extends Block {
	children: BlockKind[] = [];
}

export class Document extends ContainerBlock {
	static start() {
		return null;
	}

	continue(line: string) {
		return LINE_ENDING.test(line) ? 0 : null;
	}

	close(): void {
		this.open = false;
	}
}

export const blocks = [
	Document,
	ThematicBreak,
	ATXHeading,
	Paragraph,
	BlankLine,
];
