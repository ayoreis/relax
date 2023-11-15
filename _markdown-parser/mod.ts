// https://spec.commonmark.org/0.30/
import { LINE } from './preliminaries.ts';

// TODO last empty line opening

import {
	ATXHeading,
	BlockKind,
	blocks,
	ContainerBlock,
	Document,
	LeafBlock,
	Paragraph,
	SetextHeading,
} from './blocks.ts';

const DEBUG = true;

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

	#parseLine() {
		const unmatchedBlocks: BlockKind[] = [];
		let deepestOpenBlock: undefined | BlockKind = undefined;

		DEBUG && console.debug([this.#line]);

		do {
			const shouldContinue = this.#currentOpenBlock.continue(this.#line);

			// HACK because 0 is falsy
			if (shouldContinue === null) {
				unmatchedBlocks.push(this.#currentOpenBlock);

				DEBUG && console.debug(
					`-> ${this.#currentOpenBlock.constructor.name} closed`,
				);

				continue;
			}

			deepestOpenBlock = this.#currentOpenBlock;

			// TODO Unicode awareness
			this.#line = this.#line.slice(shouldContinue);

			DEBUG && console.debug(
				`-> ${this.#currentOpenBlock.constructor.name} continued`,
			);
		} while (
			(() => {
				if (this.#currentOpenBlock instanceof LeafBlock) return false;

				const lastChild = this.#currentOpenBlock.children.at(-1);

				if (!lastChild?.open) return false;

				this.#currentOpenBlock = lastChild;

				return true;
			})()
		);

		this.#currentOpenBlock = deepestOpenBlock ?? this.#tree;

		// TODO
		const setextHeadingMatch = SetextHeading.start(this.#line);

		if (this.#currentOpenBlock instanceof Paragraph && setextHeadingMatch) {
			const [block, index] = setextHeadingMatch;

			block.linesOfText = this.#currentOpenBlock.rawContent;

			this.#currentOpenBlock = block;

			this.#lastMatchedContainerBlock.children.pop();
			this.#lastMatchedContainerBlock.children.push(this.#currentOpenBlock);

			this.#line = this.#line.slice(index);

			for (const block of unmatchedBlocks) block.close();

			DEBUG && console.debug(
				`-> ${this.#currentOpenBlock.constructor.name} started`,
			);
		}

		let firstRun = true;

		while (
			this.#line.length > 0 &&
			((this.#currentOpenBlock === this.#lastMatchedContainerBlock) ||
				(this.#currentOpenBlock instanceof Paragraph && firstRun))
		) {
			firstRun = false;

			for (const Block of blocks) {
				if (
					this.#currentOpenBlock instanceof Paragraph &&
					Block === Paragraph
				) break;

				const match = Block.start(this.#line);

				if (!match) continue;

				const [block, index] = match;

				for (const block of unmatchedBlocks) block.close();

				// TODO parameters
				this.#currentOpenBlock = block;
				this.#lastMatchedContainerBlock.children.push(
					this.#currentOpenBlock,
				);

				if (this.#currentOpenBlock instanceof ContainerBlock) {
					this.#lastMatchedContainerBlock = this.#currentOpenBlock;
				}

				this.#line = this.#line.slice(index);

				DEBUG && console.debug(
					`-> ${this.#currentOpenBlock.constructor.name} started`,
				);

				break;
			}
		}

		if (this.#line !== '') {
			if (this.#currentOpenBlock instanceof ATXHeading) {
				this.#currentOpenBlock.rawContents += this.#line;
			} else if (this.#currentOpenBlock instanceof Paragraph) {
				this.#currentOpenBlock.rawContent += this.#line;
			} else {
				DEBUG && console.debug('Line not empty');
			}
		}

		DEBUG && console.debug();
	}

	static parse(line: string, tree: Document) {
		new this(line, tree).#parseLine();
	}
}

/** https://spec.commonmark.org/0.30/#appendix-a-parsing-strategy */
export class Parser {
	readonly #source;
	readonly #tree;

	private constructor(source: Iterable<string>) {
		this.#source = source;
		this.#tree = new Document();
	}

	/** https://spec.commonmark.org/0.30/#phase-1-block-structure */
	#parseBlockStructure() {
		for (const line of this.#source) {
			LineParser.parse(line, this.#tree);
		}
	}

	/** https://spec.commonmark.org/0.30/#phase-2-inline-structure */
	#parseInlineStructure() {
		// TODO
	}

	/** https://spec.commonmark.org/0.30/#overview */
	static parse(source: string) {
		const parser = new this(source.match(LINE)!);

		parser.#parseBlockStructure();
		parser.#parseInlineStructure();

		return parser.#tree;
	}
}
