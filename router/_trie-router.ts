import { ensureMapKey } from '../_shared/ensure-map-key.ts'

type Handler = unknown

const OWN_HANDLER_KEY = Symbol('Handler')

class Trie extends Map<URLPattern, Trie> {
	[OWN_HANDLER_KEY]?: Handler
}

class TrieRouter {
	trieTree = new Trie()

	add(pathname: string, handler: Handler) {
		const directoriesNames = pathname.split('/')

		let currentNode = this.trieTree

		for (const directoriesName of directoriesNames) {
			const key = new URLPattern({
				pathname: directoriesName,
			})

			currentNode = ensureMapKey(
				currentNode,
				key,
				new Trie(),
			)!
		}

		currentNode[OWN_HANDLER_KEY] = handler
	}

	fetch(pathname: string) {
		const directoriesNames = pathname.split('/')

		let currentNode = this.trieTree

		outer:
		for (const directoryName of directoriesNames) {
			for (
				const [urlPattern, node] of currentNode
			) {
				if (!urlPattern.test({ pathname: directoryName })) {
					continue
				}

				currentNode = node

				continue outer
			}

			return
		}

		return currentNode[OWN_HANDLER_KEY]
	}
}

const trieRouter = new TrieRouter()

trieRouter.add('/settings', 'Handler sjsjsj')

console.log(trieRouter.fetch('/settings'))
