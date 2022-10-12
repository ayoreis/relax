import { MaybePromise } from '../shared/types.ts'

export type Handler = (
	request: unknown,
	parameters: URLPatternResult | null,
) => MaybePromise<unknown>
export type RequestMiddleware = (
	request: Request,
) => MaybePromise<Request | void>
export type ResponseMiddleware = (
	request: Request,
	response: unknown,
) => MaybePromise<Response | void>

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
export type Method =
	| 'GET'
	| 'HEAD'
	| 'POST'
	| 'PUT'
	| 'DELETE'
	| 'CONNECT'
	| 'OPTIONS'
	| 'TRACE'
	| 'PATCH'

export class Router {
	#routes: Record<
		Method,
		Set<{
			pattern: URLPattern
			handler: Handler
		}>
	> = {
		GET: new Set(),
		HEAD: new Set(),
		POST: new Set(),
		PUT: new Set(),
		DELETE: new Set(),
		CONNECT: new Set(),
		OPTIONS: new Set(),
		TRACE: new Set(),
		PATCH: new Set(),
	} as const

	#requestMiddlewares: Set<RequestMiddleware> = new Set()
	#responseMiddlewares: Set<ResponseMiddleware> = new Set()

	#addRoute(method: Method, path: string, handler: Handler) {
		this.#routes[method].add({
			pattern: new URLPattern({ pathname: path }),
			handler,
		})

		return this
	}

	all(path: string, handler: Handler) {
		for (const method of Object.keys(this.#routes)) {
			this.#addRoute(method as Method, path, handler)
		}

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

	requestMiddleware(requestMiddleware: RequestMiddleware) {
		this.#requestMiddlewares.add(requestMiddleware)
	}

	responseMiddleware(responseMiddleware: ResponseMiddleware) {
		this.#responseMiddlewares.add(responseMiddleware)
	}

	fetch = async (request: Request) => {
		for (const route of this.#routes[request.method as Method]) {
			if (route.pattern.test(request.url)) {
				for (const requestMiddleware of this.#requestMiddlewares) {
					request = (await requestMiddleware(request)) ?? request
				}

				const parameters = route.pattern.exec(request.url)
				let response = await route.handler(request, parameters)

				for (const responseMiddleware of this.#responseMiddlewares) {
					response = responseMiddleware(request, response) ?? response
				}

				if (typeof request !== 'undefined') {
					return response
				}
			}
		}
	}
}
