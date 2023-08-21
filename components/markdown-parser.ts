type ATXHeadingBlockLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** https://spec.commonmark.org/0.30/#line-ending */
const LINE_ENDING = /\n|\r\n?/;
/** https://spec.commonmark.org/0.30/#blank-line */
const BLANK_LINE = /^[ \t]*$/;

const THEMATIC_BREAK = /^ {0,3}(?<type>[-_*])(?:[ \t]*\k<type>){2,}[ \t]*$/;
const PARAGRAPH = /^(?![ \t]*$).*$/;
const ATX_HEADING =
	/^ {0,3}(?<level>#{1,6})(?:(?:[ \t]+|$)(?<content>.+?))??(?:[ \t]+#+)?[ \t]*$/d;

// IDEA builder pattern for creating blocks

abstract class Block {
	// TODO Open or closed?
	open = true;
}

abstract class ContainerBlock extends Block {
	children: (ContainerBlock | LeafBlock)[] = [];
}

abstract class LeafBlock extends Block {}

class ThematicBreakBlock extends LeafBlock {}

class ATXHeadingBlock extends LeafBlock {
	contents = '';

	constructor(public level: ATXHeadingBlockLevel) {
		super();
	}
}

class ParagraphBlock extends LeafBlock {
	constructor(public text: string) {
		super();
	}
}

class BlackLineBlock extends LeafBlock {}

class DocumentBlock extends ContainerBlock {}

/** https://spec.commonmark.org/0.30/#appendix-a-parsing-strategy */
function parse(source: string) {
	// https://spec.commonmark.org/0.30/#insecure-characters
	source = source.replaceAll('\0', '\uFFFD');

	// TODO https://spec.commonmark.org/0.30/#backslash-escapes
	// TODO https://spec.commonmark.org/0.30/#entity-and-numeric-character-references

	// https://spec.commonmark.org/0.30/#overview
	const lines = source.split(LINE_ENDING);

	const treeOfBlocks = new DocumentBlock();

	// https://spec.commonmark.org/0.30/#phase-1-block-structure
	for (const line of lines) {
		const unmatchedBlocks: Block[] = [];

		let lastOpenBlock: ContainerBlock | LeafBlock = treeOfBlocks;
		let lastMatchedContainerBlock: ContainerBlock = treeOfBlocks;

		let index = 0;

		while (true) {
			if (lastOpenBlock instanceof ThematicBreakBlock) {
				unmatchedBlocks.push(lastOpenBlock);
			}

			if (lastOpenBlock instanceof ATXHeadingBlock) {
				unmatchedBlocks.push(lastOpenBlock);
			}

			if (lastOpenBlock instanceof ParagraphBlock) {
				// if (!BLANK_LINE.test(line)) {
				// 	// don't add to index, is this lazy continuation?
				// } else {
				unmatchedBlocks.push(lastOpenBlock);
				// }
			}

			if (lastOpenBlock instanceof BlackLineBlock) {
				unmatchedBlocks.push(lastOpenBlock);
			}

			// if (lastOpenBlock instanceof DocumentBlock) {
			// 	if (LINE_ENDING.test(line)) {
			// 		lastMatchedContainerBlock = lastOpenBlock;
			// 	} else {
			// 		unmatchedBlocks.push(lastOpenBlock);
			// 	}
			// }

			if (lastOpenBlock instanceof LeafBlock) break;

			const lastChild = lastOpenBlock.children.at(-1);

			if (!lastChild?.open) break;

			lastOpenBlock = lastChild;
		}

		let restOfLine = line.slice(index);

		do {
			try {
				if (THEMATIC_BREAK.test(line)) {
					lastMatchedContainerBlock.children.push(new ThematicBreakBlock());
					index = line.length;

					continue;
				}

				const atxHeadingMatch = line.match(ATX_HEADING);

				if (atxHeadingMatch) {
					lastMatchedContainerBlock.children.push(
						new ATXHeadingBlock(
							atxHeadingMatch.groups!.level!.length as ATXHeadingBlockLevel,
						),
					);

					index = atxHeadingMatch.indices![1]![1];

					continue;
				}

				if (PARAGRAPH.test(line)) {
					if (lastOpenBlock instanceof ParagraphBlock) {
						// TODO use actual line ending
						lastOpenBlock.text += `\n${restOfLine}`;
					} else {
						lastMatchedContainerBlock.children.push(new ParagraphBlock(line));
						// TODO remove from `unmatchedBlocks`
					}

					index = line.length;

					continue;
				}

				if (BLANK_LINE.test(line)) {
					lastMatchedContainerBlock.children.push(new BlackLineBlock());
					index = line.length;

					continue;
				}
			} finally {
				lastOpenBlock = treeOfBlocks;

				while (true) {
					if (lastOpenBlock instanceof LeafBlock) break;

					const lastChild = lastOpenBlock.children.at(-1);

					if (!lastChild?.open) break;

					lastOpenBlock = lastChild;
				}

				restOfLine = line.slice(index);
			}
		} while (
			index < line.length &&
			lastOpenBlock instanceof ContainerBlock
		);

		if (lastOpenBlock instanceof ATXHeadingBlock) {
			lastOpenBlock.contents += restOfLine;
		}

		for (const unmatchedBlock of unmatchedBlocks) {
			unmatchedBlock.open = false;
		}
	}

	// TODO https://spec.commonmark.org/0.30/#phase-2-inline-structure

	return treeOfBlocks;
}

console.log(parse(`# Hello world

---

Paragraph
Part 2`));
