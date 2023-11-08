// https://spec.commonmark.org/0.30/

type ContainerBlockKind = Document;
type LeafBlockKind = ThematicBreak | Paragraph | BlankLine;
type BlockKind = ContainerBlockKind | LeafBlockKind;

// https://spec.commonmark.org/0.30/#preliminaries
// TODO ^$
/** https://spec.commonmark.org/0.30/#line-ending */
export const LINE_ENDING = /\n|\r\n?/;
/** https://spec.commonmark.org/0.30/#blank-line */
const BLANK_LINE = /^[ \t]*$/;

/** https://spec.commonmark.org/0.30/#blocks */
abstract class Block {
	abstract readonly type: string;
	open = true;

	// @ts-expect-error https://github.com/microsoft/TypeScript/issues/34516
	static start(_line: string): null | number {}
	abstract continue(_line: string): null | number;
	abstract close(): void;
}

/** https://spec.commonmark.org/0.30/#container-blocks */
abstract class ContainerBlock extends Block {
	children: BlockKind[] = [];
}

class Document extends ContainerBlock {
	readonly type = 'Document';

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

/** https://spec.commonmark.org/0.30/#leaf-blocks */
abstract class LeafBlock extends Block {
}

/** https://spec.commonmark.org/0.30/#thematic-breaks */
class ThematicBreak extends LeafBlock {
	readonly type = 'ThematicBreak';

	static readonly #REGEX =
		/^ {0,3}(?<type>[-_*])(?:[ \t]*\k<type>){2,}[ \t]*$/;

	static start(line: string) {
		return this.#REGEX.test(line) ? line.length : null;
	}

	continue() {
		return null;
	}

	close(): void {
		this.open = false;
	}
}

/** https://spec.commonmark.org/0.30/#paragraphs */
class Paragraph extends LeafBlock {
	readonly type = 'Paragraph';
	content = '';

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

/** https://spec.commonmark.org/0.30/#blank-lines */
class BlankLine extends LeafBlock {
	readonly type = 'BlankLine';

	static start(line: string) {
		return BLANK_LINE.test(line) ? 0 : null;
	}

	continue() {
		return null;
	}

	close(): void {
		this.open = false;
	}
}

const containerBlocks = [Document];
const leafBlocks = [ThematicBreak, Paragraph, BlankLine];
const blocks = [...containerBlocks, ...leafBlocks];

// TODO
type UnicodeCodePoint = string;
/** https://spec.commonmark.org/0.30/#character */
type Character = UnicodeCodePoint;

class LineParser {
	#line;
	readonly #tree;
	#currentOpenBlock: BlockKind;
	#lastMatchedContainerBlock: ContainerBlock;

	private constructor(line: string, tree: Document) {
		this.#line = line;
		this.#tree = tree;

		this.#currentOpenBlock = this.#tree;
		this.#lastMatchedContainerBlock = this.#tree;
	}

	#consume(block: BlockKind) {
		const shouldContinue = block.continue(this.#line);

		// HACK because 0 is falsy
		if (shouldContinue === null) return false;

		this.#line = this.#line.slice(shouldContinue);

		return true;
	}

	#computeBlocks() {
		if (this.#currentOpenBlock instanceof LeafBlock) return false;

		const lastChild = this.#currentOpenBlock.children.at(-1);

		// TODO
		// console.assert(!(lastChild && !lastChild.open));
		if (!lastChild?.open) return false;

		this.#currentOpenBlock = lastChild;

		return true;
	}

	#parseLine() {
		const unmatchedBlocks: BlockKind[] = [];

		do {
			const shouldContinue = this.#consume(this.#currentOpenBlock);

			if (!shouldContinue) {
				unmatchedBlocks.push(this.#currentOpenBlock);
				continue;
			}

			// TODO may be open but not matched! revert to last matched
			// open child of closed parent?

			if (this.#currentOpenBlock instanceof ContainerBlock) {
				this.#lastMatchedContainerBlock = this.#currentOpenBlock;
			}
		} while (this.#computeBlocks());

		// curr =
		// Doc   enter
		// Para  enter to check for other blocks
		// Blank do not enter
		// Break do not enter

		// enter =
		// index < lenght
		// last === container
		// paragrapgh && first time

		// TODO TypeScript says only Paragraph and Document reach here, why?

		let firstRun = true;

		while (
			this.#line.length > 0 &&
			((this.#currentOpenBlock === this.#lastMatchedContainerBlock) ||
				(this.#currentOpenBlock.type === 'Paragraph' && firstRun))
		) {
			firstRun = false;

			let close = false;

			for (const blockStart of blocks) {
				const shouldStart = blockStart.start(this.#line);

				if (shouldStart === null) continue;

				close = true;

				// TODO parameters
				const block = new blockStart();

				this.#lastMatchedContainerBlock.children.push(block);
			}

			// TODO lazy continuation
			// TODO recompute this.#currentBlock and this.#lastMatchedContainer
			this.#computeBlocks();

			if (!close) continue;

			for (const block of unmatchedBlocks) block.close();
		}

		if (this.#line !== '' && this.#currentOpenBlock.type === 'Paragraph') {
			this.#currentOpenBlock.content = this.#line;
		}
	}

	static parse(line: string, tree: Document) {
		const parser = new this(line, tree);
		parser.#parseLine();
	}
}

/** https://spec.commonmark.org/0.30/#appendix-a-parsing-strategy */
export class Parser {
	readonly #lines;
	readonly #tree;

	private constructor(source: Iterable<string>) {
		this.#lines = source;
		this.#tree = new Document();
	}

	/** https://spec.commonmark.org/0.30/#phase-1-block-structure */
	#parseBlockStructure() {
		for (const line of this.#lines) {
			// String.split vs Array.from
			// const codePoints = line.split('');
			LineParser.parse(line, this.#tree);
		}
	}

	/** https://spec.commonmark.org/0.30/#phase-2-inline-structure */
	#parseInlineStructure() {
		// TODO
	}

	/** https://spec.commonmark.org/0.30/#overview */
	static parse(source: Iterable<string>) {
		const parser = new this(source);

		parser.#parseBlockStructure();
		parser.#parseInlineStructure();

		return parser.#tree;
	}
}
