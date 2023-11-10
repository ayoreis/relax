// https://spec.commonmark.org/0.30/
import { LINE_ENDING } from './preliminaries.ts';

import {
	BlockKind,
	blocks,
	ContainerBlock,
	Document,
	LeafBlock,
	Paragraph,
} from './blocks.ts';

const DEBUG = false;

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
		let deepestOpenBlock!: BlockKind;

		DEBUG && console.debug([this.#line]);

		do {
			const shouldContinue = this.#currentOpenBlock.continue(
				this.#line,
			);

			// HACK because 0 is falsy
			if (shouldContinue === null) {
				unmatchedBlocks.push(this.#currentOpenBlock);
				continue;
			}

			deepestOpenBlock = this.#currentOpenBlock;

			// TODO Unicode awareness
			this.#line = this.#line.slice(shouldContinue);

			DEBUG && console.debug(
				`-> ${this.#currentOpenBlock.constructor.name} ${
					shouldContinue ? 'continued' : 'closed'
				}`,
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

		this.#currentOpenBlock = deepestOpenBlock;

		let firstRun = true;

		while (
			this.#line.length > 0 &&
			((this.#currentOpenBlock === this.#lastMatchedContainerBlock) ||
				(this.#currentOpenBlock instanceof Paragraph && firstRun))
		) {
			firstRun = false;

			for (const Block of blocks) {
				const shouldStart = Block.start(this.#line);

				if (shouldStart === null) continue;

				for (const block of unmatchedBlocks) block.close();

				if (
					this.#currentOpenBlock instanceof Paragraph &&
					Block === Paragraph
				) break;

				// TODO parameters
				this.#currentOpenBlock = new Block();
				this.#lastMatchedContainerBlock.children.push(
					this.#currentOpenBlock,
				);

				if (this.#currentOpenBlock instanceof ContainerBlock) {
					this.#lastMatchedContainerBlock = this.#currentOpenBlock;
				}

				this.#line = this.#line.slice(shouldStart);

				DEBUG && console.debug(
					`-> ${this.#currentOpenBlock.constructor.name} started`,
				);

				break;
			}
		}

		if (this.#line !== '') {
			if (this.#currentOpenBlock instanceof Paragraph) {
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
		const parser = new this(source.match(LINE_ENDING)!);

		parser.#parseBlockStructure();
		parser.#parseInlineStructure();

		return parser.#tree;
	}
}
