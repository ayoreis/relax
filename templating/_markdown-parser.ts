declare global {
	interface RegExpMatchArray {
		indices: [number, number][];
	}
}

import { todo } from '../_shared/todo.ts';

type ATXHeadingBlockLevel = 1 | 2 | 3 | 4 | 5 | 6;
type SetextHeadingBlockLevel = 1 | 2;

// https://spec.commonmark.org/0.30
// https://spec.commonmark.org/0.30/#preliminaries
// https://spec.commonmark.org/0.30/#characters-and-lines

/** https://spec.commonmark.org/0.30/#line-ending */
const LINE_ENDING = /(?<=\n|\r\n?)/;
/** https://spec.commonmark.org/0.30/#blank-line */
const BLANK_LINE = /^[ \t]*(\n|\r\n?)$/d;

/** https://spec.commonmark.org/0.30/#blocks */
abstract class Block {
	children: Block[] = [];
	open = true;
	_lastIndex = 0;

	// TODO https://github.com/microsoft/TypeScript/issues/34516
	static [Symbol.match](_line: string): Block | null {
		return null;
	}

	abstract [Symbol.match](line: string): boolean;
	abstract close(): void;
}

/** https://spec.commonmark.org/0.30/#container-blocks */
abstract class ContainerBlock extends Block {}

/** https://spec.commonmark.org/0.30/#leaf-blocks */
abstract class LeafBlock extends Block {}

/** https://spec.commonmark.org/0.30/#overview */
class DocumentBlock extends ContainerBlock {
	static [Symbol.match]() {
		return null;
	}

	[Symbol.match]() {
		return true;
	}

	close() {
		this.open = false;
	}
}

/** https://spec.commonmark.org/0.30/#thematic-breaks */
class ThematicBreakBlock extends LeafBlock {
	static #THEMATIC_BREAK =
		/^ {0,3}(?<type>[-_*])[ \t]*(?:\k<type>[ \t]*){2,}(?:\n|\r\n?)$/;

	static [Symbol.match](line: string) {
		if (!this.#THEMATIC_BREAK.test(line)) return null;

		const thematicBreakBlock = new this();

		thematicBreakBlock._lastIndex = line.length - 1;

		return thematicBreakBlock;
	}

	[Symbol.match]() {
		return false;
	}

	close() {
		this.open = false;
	}
}

/** https://spec.commonmark.org/0.30/#atx-headings */
class ATXHeadingBlock extends LeafBlock {
	static #ATX_HEADING_START =
		/^ {0,3}(?<level>#{1,6})(?=(?:[ \t]|(\n|\r\n?)$))/d;

	#ATX_HEADING_RAW_CONTENTS_AFTER_START =
		/^(?:(?:[ \t]+|$)(?<rawContents>.*?))??([ \t]+#+)?(\n|\r\n?)$/;

	rawContents = '';
	level!: ATXHeadingBlockLevel;

	static [Symbol.match](line: string) {
		const ATXHeadingMatch = line.match(
			this.#ATX_HEADING_START,
		);

		if (!ATXHeadingMatch) return null;

		const ATXHeadingBlock = new this();

		ATXHeadingBlock.level = Number(
			ATXHeadingMatch.groups!.level.length,
		) as ATXHeadingBlockLevel;

		ATXHeadingBlock._lastIndex =
			ATXHeadingMatch.indices[0][1];

		return ATXHeadingBlock;
	}

	[Symbol.match]() {
		return false;
	}

	close(): void {
		// change raw content
		const r = this.rawContents.match(
			this.#ATX_HEADING_RAW_CONTENTS_AFTER_START,
		);

		this.rawContents = r!.groups!.rawContents;

		this.open = false;
	}
}

/** https://spec.commonmark.org/0.30/#setext-headings */
class SetextHeadingBlock extends LeafBlock {
	/** https://spec.commonmark.org/0.30/#setext-heading-underline */
	static #SETEXT_HEADING_UNDERLINE =
		/^ {0,3}(?<type>[=-])\k<type>*[ \t]*(\n|\r\n?)$/d;

	level!: SetextHeadingBlockLevel;

	rawContent = '';

	static [Symbol.match](line: string) {
		const setextHeadingMatch = line.match(
			this.#SETEXT_HEADING_UNDERLINE,
		);

		if (!setextHeadingMatch) return null;

		const setextHeadingBlock = new this();

		console.log(setextHeadingMatch.groups);

		setextHeadingBlock._lastIndex =
			setextHeadingMatch.indices[0][1];

		return setextHeadingBlock;
	}

	[Symbol.match]() {
		return false;
	}

	close(): void {
		this.open = false;

		// TODO Stuff
	}
}

/** https://spec.commonmark.org/0.30/#paragraphs */
class ParagraphBlock extends LeafBlock {
	rawContent = '';

	[Symbol.match](line: string) {
		return !line.match(BLANK_LINE);
	}

	static [Symbol.match](line: string) {
		if (BLANK_LINE.test(line)) return null;

		return new this();
	}

	close() {
		this.open = false;

		// TODO Stuff
	}
}

/** https://spec.commonmark.org/0.30/#blank-lines */
class BlankLineBlock extends LeafBlock {
	[Symbol.match]() {
		return false;
	}

	static [Symbol.match](line: string) {
		const blankLineMatch = line.match(BLANK_LINE);

		if (!blankLineMatch) return null;

		const blankLineBlock = new this();

		blankLineBlock._lastIndex =
			blankLineMatch!.indices[0][1];

		return blankLineBlock;
	}

	close() {
		this.open = false;
	}
}

const BLOCKS = [
	ThematicBreakBlock,
	ATXHeadingBlock,
	// SetextHeadingBlock,
	ParagraphBlock,
	BlankLineBlock,
] as const;

/** https://spec.commonmark.org/0.30/#appendix-a-parsing-strategy */
export function parse(input: string) {
	// https://spec.commonmark.org/0.30/#insecure-characters
	input = input.replaceAll('\0', '\uFFFD');

	// TODO https://spec.commonmark.org/0.30/#backslash-escapes
	// TODO https://spec.commonmark.org/0.30/#entity-and-numeric-character-references

	// https://spec.commonmark.org/0.30/#overview
	const treeOfBlocks = new DocumentBlock();

	// https://spec.commonmark.org/0.30/#phase-1-block-structure
	const lines = input.split(LINE_ENDING);

	for (const line of lines) {
		const unmatchedBlocks: Block[] = [];

		let index = 0;
		let lastOpenBlock: Block = treeOfBlocks;
		let lastMatchedContainerBlock = lastOpenBlock;

		while (true) {
			const match = line.match( // @ts-ignore Definition is wrong
				lastOpenBlock as unknown as Block,
			) as unknown as Block;

			if (!match) {
				unmatchedBlocks.push(lastOpenBlock);
			} else {
				// index += lastOpenBlock._lastIndex;

				if (match instanceof ContainerBlock) {
					lastMatchedContainerBlock = lastOpenBlock;
				}
			}

			const lastChild = lastOpenBlock.children.at(-1);

			if (!lastChild?.open) break;

			lastOpenBlock = lastChild!;
		}

		if (lastOpenBlock instanceof ParagraphBlock) {
			const setextHeadingMatch = line.match(
				// @ts-ignore Definition is wrong
				SetextHeadingBlock,
			) as unknown as SetextHeadingBlock;

			if (
				!setextHeadingMatch
			) continue;

			index += setextHeadingMatch._lastIndex;

			setextHeadingMatch.rawContent =
				lastOpenBlock.rawContent;

			setextHeadingMatch.level;

			lastMatchedContainerBlock.children.pop();
			lastMatchedContainerBlock.children.push(
				setextHeadingMatch,
			);

			lastOpenBlock = setextHeadingMatch;
		}

		let restOfLine = line.slice(index);

		do {
			for (const block of BLOCKS) {
				const match = restOfLine.match(
					// @ts-ignore Definition is wrong
					block,
				) as unknown as Block | null;

				if (!match) continue;

				for (const unmatchedBlock of unmatchedBlocks) {
					unmatchedBlock.close;
				}

				lastMatchedContainerBlock.children.push(
					match,
				);

				lastOpenBlock = match;
				index += match._lastIndex;
				restOfLine = line.slice(index);

				break;
			}

			console.log('here', [restOfLine]);
		} while (
			index < line.length &&
			lastOpenBlock instanceof ContainerBlock
		);

		for (const unmatchedBlock of unmatchedBlocks) {
			unmatchedBlock.close();
		}

		lastOpenBlock = treeOfBlocks;

		while (true) {
			const lastChild = lastOpenBlock.children.at(-1);

			if (!lastChild?.open) break;

			lastOpenBlock = lastChild!;
		}

		if (
			lastOpenBlock instanceof ATXHeadingBlock
		) {
			lastOpenBlock.rawContents += restOfLine;
		} else if (lastOpenBlock instanceof ParagraphBlock) {
			lastOpenBlock.rawContent += restOfLine;
		} else {
			todo();
		}

		// TODO Reference link definitions are detected when a paragraph is closed; the accumulated text lines are parsed to see if they  begin with one or more reference link definitions. Any remainder becomes a normal paragraph.
	}

	// TODO Close all open blocks
	treeOfBlocks.close();

	// TODO https://spec.commonmark.org/0.30/#phase-2-inline-structure

	return treeOfBlocks;
}

console.log(
	parse(`# Hello world

___

Lorem ipsum 1.
---



Lorem ipsum 2.`),
);
