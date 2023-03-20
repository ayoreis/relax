import { red } from './_dependencies.ts';

// https://spec.commonmark.org/0.30
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
	open = true;
	lastIndex = 0;

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

/** https://spec.commonmark.org/0.30/#container-blocks */
class ContainerBlock extends Block {}

/** https://spec.commonmark.org/0.30/#leaf-blocks */
class LeafBlock extends Block {}

/** https://spec.commonmark.org/0.30/#overview */
class DocumentBlock extends ContainerBlock {
	[Symbol.match]() {
		return true;
	}
}

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
		return !line.match(BLANK_LINE);
	}

	static [Symbol.match](line: string) {
		if (BLANK_LINE.test(line)) return null;

		return new this();
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
		const unmatchedBlocks: Block[] = [];

		let index = 0;
		let lastOpenBlock: Block = treeOfBlocks;
		let lastMatchedContainerBlock = lastOpenBlock;

		while (true) {
			// @ts-ignore Definition is wrong
			const match = line.match(lastOpenBlock);

			if (!match) {
				unmatchedBlocks.push(lastOpenBlock);
			} else {
				index += lastOpenBlock.lastIndex;

				if (match instanceof ContainerBlock) {
					lastMatchedContainerBlock = lastOpenBlock;
				}
			}

			const lastChild = lastOpenBlock.children.at(-1);

			if (!lastChild?.open) break;

			lastOpenBlock = lastChild!;
		}

		let restOfLine = line.slice(index);

		while (
			index < line.length &&
			lastOpenBlock instanceof ContainerBlock
		) {
			const thematicBreakBlockMatch = restOfLine.match( // @ts-ignore Definition is wrong
				ThematicBreakBlock,
			) as unknown as ThematicBreakBlock | null;

			if (thematicBreakBlockMatch) {
				for (const unmatchedBlock of unmatchedBlocks) {
					unmatchedBlock.close;
				}

				lastMatchedContainerBlock.children.push(
					thematicBreakBlockMatch,
				);

				lastOpenBlock = thematicBreakBlockMatch;
				index += thematicBreakBlockMatch.lastIndex;
				restOfLine = line.slice(index);

				continue;
			}

			const paragraphBlockMatch = restOfLine.match( // @ts-ignore Definition is wrong
				ParagraphBlock,
			) as unknown as ParagraphBlock | null;

			if (paragraphBlockMatch) {
				for (const unmatchedBlock of unmatchedBlocks) {
					unmatchedBlock.close;
				}

				lastMatchedContainerBlock.children.push(
					paragraphBlockMatch,
				);

				lastOpenBlock = paragraphBlockMatch;
				index += paragraphBlockMatch.lastIndex;
				restOfLine = line.slice(index);

				continue;
			}
		}

		for (const unmatchedBlock of unmatchedBlocks) {
			unmatchedBlock.close();
		}

		lastOpenBlock = treeOfBlocks;

		while (true) {
			const lastChild = lastOpenBlock.children.at(-1);

			if (!lastChild?.open) break;

			lastOpenBlock = lastChild!;
		}

		if (lastOpenBlock instanceof ParagraphBlock) {
			lastOpenBlock.rawContent += restOfLine;
		} else {
			console.error(red('TODO'));
		}

		// TODO Setext headings are formed when we see a line of a paragraph that is a setext heading underline.

		// TODO Reference link definitions are detected when a paragraph is closed; the accumulated text lines are parsed to see if they  begin with one or more reference link definitions. Any remainder becomes a normal paragraph.
	}

	// TODO Close all open blocks
	treeOfBlocks.close();

	// TODO https://spec.commonmark.org/0.30/#phase-2-inline-structure

	return treeOfBlocks;
}

console.log(parse(`# Hello world

Lorem ipsum 1.

---

Lorem ipsum 2.`));
