import { MaybePromise } from '../shared/types.ts'

/** https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods */
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

export type BeforeMiddlewareCallback = (
	request: Request,
	URLPattern: URLPatternResult | null,
) => MaybePromise<void>

export type HandlerCallback = (
	request: Request,
	parameters: URLPatternComponentResult['groups'],
) => MaybePromise<Response | void>

export type AfterMiddlewareCallback = (
	request: Request,
	URLPattern: URLPatternResult | null,
	response: Response,
) => MaybePromise<void>

export class Router {
	#routes: Record<
		Method,
		Set<{
			URLPattern: URLPattern
			handler: HandlerCallback
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

	#beforeMiddleware = new Set<BeforeMiddlewareCallback>()
	#afterMiddleware = new Set<AfterMiddlewareCallback>()

	#addRoute(method: Method, path: string, handler: HandlerCallback) {
		this.#routes[method].add({
			URLPattern: new URLPattern({ pathname: path }),
			handler,
		})

		return this
	}

	all(path: string, handler: HandlerCallback) {
		for (const method in this.#routes) {
			this.#addRoute(method as Method, path, handler)
		}

		return this
	}

	get(path: string, handler: HandlerCallback) {
		return this.#addRoute('GET', path, handler)
	}

	head(path: string, handler: HandlerCallback) {
		return this.#addRoute('HEAD', path, handler)
	}

	post(path: string, handler: HandlerCallback) {
		return this.#addRoute('POST', path, handler)
	}

	put(path: string, handler: HandlerCallback) {
		return this.#addRoute('PUT', path, handler)
	}

	delete(path: string, handler: HandlerCallback) {
		return this.#addRoute('DELETE', path, handler)
	}

	connect(path: string, handler: HandlerCallback) {
		return this.#addRoute('CONNECT', path, handler)
	}

	options(path: string, handler: HandlerCallback) {
		return this.#addRoute('OPTIONS', path, handler)
	}

	trace(path: string, handler: HandlerCallback) {
		return this.#addRoute('TRACE', path, handler)
	}

	patch(path: string, handler: HandlerCallback) {
		return this.#addRoute('PATCH', path, handler)
	}

	before(beforeMiddlewareCallback: BeforeMiddlewareCallback) {
		this.#beforeMiddleware.add(beforeMiddlewareCallback)
	}

	after(afterMiddlewareCallback: AfterMiddlewareCallback) {
		this.#afterMiddleware.add(afterMiddlewareCallback)
	}

	fetch = async (request: Request) => {
		for (const route of this.#routes[request.method as Method]) {
			if (!route.URLPattern.test(request.url)) continue

			const URLPatternResult = route.URLPattern.exec(request.url)

			for (const beforeMiddleware of this.#beforeMiddleware) {
				await beforeMiddleware(request, URLPatternResult)
			}

			const response = await route.handler(
				request,
				URLPatternResult?.pathname.groups ?? {},
			)

			if (typeof response === 'undefined') continue

			for (const responseMiddleware of this.#afterMiddleware) {
				responseMiddleware(request, URLPatternResult, response!)
			}

			return response
		}

		return new Response(null, { status: 404, statusText: 'Not found' })
	}
}
