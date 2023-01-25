/*
    Todo:
    -   Several handlers
*/

type Handler = unknown
type IndexType = string | number | symbol

interface Routes {
	[key: string]: Routes
	[key: symbol]: Handler
}

function ensureKey(
	object: Record<IndexType, unknown>,
	key: IndexType,
	value: unknown,
) {
	if (object[key]) return

	object[key] = value
}

const OWN_HANDLER_KEY = Symbol('Own handler key')

class TrieRouter {
	#routes: Routes = {}

	add(pathname: string, handler: Handler) {
		const parts = pathname.split('/')

		let currentPart = this.#routes

		for (const part of parts) {
			ensureKey(currentPart, part, {})

			currentPart = currentPart[part]
		}

		currentPart[OWN_HANDLER_KEY] = handler
	}

	fetch(pathname: string) {
		const parts = pathname.split('/')

		let currentPart = this.#routes

		for (const part of parts) {
			currentPart = currentPart[part]
		}

		return currentPart[OWN_HANDLER_KEY]
	}
}

const trieRouter = new TrieRouter()

trieRouter.add('/settings/password/reset', 'Handler')
console.log(trieRouter.fetch('/settings/password/reset'))
