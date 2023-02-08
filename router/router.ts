import type { MaybePromise } from '../_shared/types.ts'
import type { Method } from './_http-methods.ts'

export type Handler = (
	request: Request,
	parameters: URLPatternComponentResult['groups'],
) => MaybePromise<Response | void>

type Match = { URLPattern: URLPattern; handler: Handler }

export class Router {
	#cache: Record<
		string,
		Match[]
	> = {}

	#routes: Record<
		Method,
		Match[]
	> = {
		GET: [],
		HEAD: [],
		POST: [],
		PUT: [],
		DELETE: [],
		CONNECT: [],
		OPTIONS: [],
		TRACE: [],
		PATCH: [],
	}

	#addRoute(
		method: Method,
		pathname: string,
		handler: Handler,
	) {
		this.#routes[method].push({
			URLPattern: new URLPattern({ pathname: pathname }),
			handler,
		})

		this.#cache = {}

		return this
	}

	get(path: string, handler: Handler) {
		return this.#addRoute('GET', path, handler)
	}

	head(path: string, handler: Handler) {
		return this.#addRoute('HEAD', path, handler)
	}

	post(path: string, handler: Handler) {
		return this.#addRoute('POST', path, handler)
	}

	put(path: string, handler: Handler) {
		return this.#addRoute('PUT', path, handler)
	}

	delete(path: string, handler: Handler) {
		return this.#addRoute('DELETE', path, handler)
	}

	connect(path: string, handler: Handler) {
		return this.#addRoute('CONNECT', path, handler)
	}

	options(path: string, handler: Handler) {
		return this.#addRoute('OPTIONS', path, handler)
	}

	trace(path: string, handler: Handler) {
		return this.#addRoute('TRACE', path, handler)
	}

	patch(path: string, handler: Handler) {
		return this.#addRoute('PATCH', path, handler)
	}

	fetch = async (request: Request) => { // CLEAR CACHE?
		const method = request.method.toUpperCase()
		const id = `${method}${request.url}`

		const doCache = true

		if (typeof this.#cache[id] === 'undefined') {
			this.#cache[id] = []

			for (
				const { handler, URLPattern } of this
					.#routes[request.method as Method]
			) {
				const URLPatternResult = URLPattern.exec(
					request.url,
				)

				if (URLPatternResult === null) continue

				this.#cache[id].push({ URLPattern, handler })
			}
		}

		for (const { URLPattern, handler } of this.#cache[id]) {
			const URLPatternResult = URLPattern.exec(
				request.url,
			)!

			const response = await handler(
				request,
				URLPatternResult.pathname.groups,
			)

			if (typeof response === 'undefined') continue

			return response
		}
	}
}
