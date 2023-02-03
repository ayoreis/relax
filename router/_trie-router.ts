type KeyOfMap<TheMap extends Map<unknown, unknown>> =
	TheMap extends Map<infer Key, unknown> ? Key : never

type ValueOfMap<TheMap extends Map<unknown, unknown>> =
	TheMap extends Map<unknown, infer Value> ? Value : never

type Handler = unknown
type Route = Map<URLPattern | symbol, Route | Handler>

const OWN_HANDLER_KEY = Symbol('Own handler key')

function ensureMapKey<
	TheMap extends Map<unknown, unknown>,
>(
	map: TheMap,
	key: KeyOfMap<TheMap>,
	value: ValueOfMap<TheMap>,
) {
	if (map.has(key)) return

	map.set(key, value)
}

class TrieRouter {
	#routes: Route = new Map()

	add(pathname: string, handler: Handler) {
		const directoriesNames = pathname.split('/')

		let currentRoute = this.#routes

		for (const directoriesName of directoriesNames) {
			const urlPattern = new URLPattern({
				pathname: directoriesName,
			})

			ensureMapKey(
				currentRoute,
				urlPattern,
				new Map(),
			)

			currentRoute = currentRoute.get(urlPattern) as Route
		}

		currentRoute.set(OWN_HANDLER_KEY, handler)
	}

	fetch(pathname: string) {
		const directoriesNames = pathname.split('/')

		let currentRoute = this.#routes

		for (const directoryName of directoriesNames) {
			for (
				const [urlPattern, route] of currentRoute as Map<
					URLPattern,
					Route
				>
			) {
				if (!urlPattern.test({ pathname: directoryName })) {
					continue
				}

				currentRoute = route

				break
			}
		}

		return currentRoute.get(OWN_HANDLER_KEY)
	}
}

const trieRouter = new TrieRouter()

trieRouter.add('/', 'Handler sjsjsj')
console.log(trieRouter.fetch('/settings/password/reset'))
