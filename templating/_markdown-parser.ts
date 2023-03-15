/** https://spec.commonmark.org/0.30 */
// https://spec.commonmark.org/0.30/#preliminaries
// https://spec.commonmark.org/0.30/#characters-and-lines

/** https://spec.commonmark.org/0.30/#line-ending */
const LINE_ENDING = /(?<=\n|\r\n?)/;
/** https://spec.commonmark.org/0.30/#blank-line */
const BLANK_LINE = /^[ \t]*(\n|\r\n?)$/;

/** https://spec.commonmark.org/0.30/#thematic-breaks */
const THEMATIC_BREAK =
	/^ {0,3}(?<type>[-_*])[ \t]*(?:\k<type>[ \t]*){2,}(?:\n|\r\n?)$/;

/** https://spec.commonmark.org/0.30/#blocks */
class Block {
	children: Block[] = [];
	// TODO Open vs closed
	open = true;

	lastIndex?: number;

	[Symbol.match](_line: string) {
		return false;
	}

	close() {
		this.open = false;
	}

	static [Symbol.match](_line: string): Block | null {
		return null;
	}
}

/** https://spec.commonmark.org/0.30/#leaf-blocks */
class LeafBlock extends Block {}

/** https://spec.commonmark.org/0.30/#container-blocks */
class ContainerBlock extends Block {}

/** https://spec.commonmark.org/0.30/#overview */
class DocumentBlock extends ContainerBlock {}

/** https://spec.commonmark.org/0.30/#thematic-breaks */
class ThematicBreakBlock extends LeafBlock {
	[Symbol.match]() {
		return false;
	}

	static [Symbol.match](line: string) {
		if (!THEMATIC_BREAK.test(line)) return null;

		const thematicBreakBlock = new this();

		thematicBreakBlock.lastIndex = line.length - 1;

		return thematicBreakBlock;
	}
}

/** https://spec.commonmark.org/0.30/#paragraphs */
class ParagraphBlock extends LeafBlock {
	rawContent = '';

	[Symbol.match](line: string) {
		const blankLineMatch = line.match(BLANK_LINE);

		if (blankLineMatch) {
			return false;
		}

		this.lastIndex = 0;

		return true;
	}

	static [Symbol.match](line: string) {
		if (BLANK_LINE.test(line)) return null;

		const paragraphBlock = new this();

		paragraphBlock.lastIndex = 0;

		return paragraphBlock;
	}
}

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
		let index = 0;

		const unmatchedBlocks: Block[] = [];
		let lastOpenBlock: Block = treeOfBlocks;
		let lastMatchedContainerBlock = lastOpenBlock;

		while (true) {
			const match = line.match( // @ts-ignore Definition is wrong
				lastOpenBlock,
			) as unknown as boolean;

			if (!match) {
				unmatchedBlocks.push(lastOpenBlock);
			} else if (lastOpenBlock instanceof ContainerBlock) {
				lastMatchedContainerBlock = lastOpenBlock;

				index += lastOpenBlock.lastIndex!;
			}

			const lastChild = lastOpenBlock.children.at(-1);

			if (!(lastChild?.open)) break;

			lastOpenBlock = lastChild;
		}

		for (; index < line.length;) {
			const restOfLine = line.slice(index);

			if (lastOpenBlock instanceof ContainerBlock) {
				const paragraphBlockMatch = restOfLine.match( // @ts-ignore Definition is wrong
					ParagraphBlock,
				) as unknown as ParagraphBlock;

				const thematicBreakBlock = restOfLine.match( // @ts-ignore Definition is wrong
					ThematicBreakBlock,
				) as unknown as ThematicBreakBlock;

				if (thematicBreakBlock) {
					for (const unmatchedBlock of unmatchedBlocks) {
						unmatchedBlock.close();
					}

					lastMatchedContainerBlock.children.push(
						thematicBreakBlock,
					);

					lastOpenBlock = thematicBreakBlock;
				} else if (paragraphBlockMatch) {
					for (const unmatchedBlock of unmatchedBlocks) {
						unmatchedBlock.close();
					}

					lastMatchedContainerBlock.children.push(
						paragraphBlockMatch,
					);

					lastOpenBlock = paragraphBlockMatch;
				}
			} else if (lastOpenBlock instanceof LeafBlock) {
				// TODO Test if paragraph should continue
				for (const unmatchedBlock of unmatchedBlocks) {
					unmatchedBlock.close();
				}

				if (lastOpenBlock instanceof ParagraphBlock) {
					lastOpenBlock.rawContent += restOfLine;
				}

				index += restOfLine.length;
			}
		}

		// TODO Setext headings are formed when we see a line of a paragraph that is a setext heading underline.

		// TODO Reference link definitions are detected when a paragraph is closed; the accumulated text lines are parsed to see if they  begin with one or more reference link definitions. Any remainder becomes a normal paragraph.
	}

	// TODO close all open blocks
	treeOfBlocks.close();

	// TODO https://spec.commonmark.org/0.30/#phase-2-inline-structure

	return treeOfBlocks;
}
