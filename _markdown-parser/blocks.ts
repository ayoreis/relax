import { BLANK_LINE } from './preliminaries.ts';

export type ContainerBlockKind = Document;
export type LeafBlockKind = ThematicBreak | Paragraph | BlankLine;
export type BlockKind = ContainerBlockKind | LeafBlockKind;

/** 3. https://spec.commonmark.org/0.30/#blocks */
export abstract class Block {
	open = true;

	// @ts-expect-error https://github.com/microsoft/TypeScript/issues/34516
	static start(_line: string): null | number {}
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
		return this.#THEMATIC_BREAK.test(line) ? line.length : null;
	}

	continue() {
		return null;
	}

	close(): void {
		this.open = false;
	}
}

/** 4.2. https://spec.commonmark.org/0.30/#paragraphs */
export class Paragraph extends LeafBlock {
	rawContent = '';

	static start(line: string) {
		return BLANK_LINE.test(line) ? null : 0;
	}

	continue(line: string) {
		return BLANK_LINE.test(line) ? null : 0;
	}

	close(): void {
		this.open = false;
	}
}

/** 4.3. https://spec.commonmark.org/0.30/#blank-lines */
export class BlankLine extends LeafBlock {
	static start(line: string) {
		return BLANK_LINE.test(line) ? line.length : null;
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

	continue() {
		return 0;
	}

	close(): void {
		this.open = false;
	}
}

export const blocks = [Document, ThematicBreak, Paragraph, BlankLine];
