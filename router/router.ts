import { Status } from 'https://deno.land/std@0.159.0/http/http_status.ts'

type MaybeAsync<T> = T | Promise<T>

type Handler = (
	request: Request,
	parameters: URLPatternResult | null,
) => MaybeAsync<Response>

type Method =
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

	#addRoute(method: Method, pathname: string, handler: Handler) {
		this.#routes[method].add({
			pattern: new URLPattern({ pathname }),
			handler,
		})
	}

	all(path: string, handler: Handler) {
		for (const method of Object.values(this.#routes)) {
			method.add({
				pattern: new URLPattern({ pathname: path }),
				handler,
			})
		}
	}

	get(path: string, handler: Handler) {
		this.#addRoute('GET', path, handler)
	}

	head(path: string, handler: Handler) {
		this.#addRoute('HEAD', path, handler)
	}

	post(path: string, handler: Handler) {
		this.#addRoute('POST', path, handler)
	}

	put(path: string, handler: Handler) {
		this.#addRoute('PUT', path, handler)
	}

	delete(path: string, handler: Handler) {
		this.#addRoute('DELETE', path, handler)
	}

	connect(path: string, handler: Handler) {
		this.#addRoute('CONNECT', path, handler)
	}

	options(path: string, handler: Handler) {
		this.#addRoute('OPTIONS', path, handler)
	}

	trace(path: string, handler: Handler) {
		this.#addRoute('TRACE', path, handler)
	}

	patch(path: string, handler: Handler) {
		this.#addRoute('PATCH', path, handler)
	}

	handle(request: Request): MaybeAsync<Response> {
		for (const route of this.#routes[request.method as Method]) {
			if (route.pattern.test(request.url)) {
				const parameters = route.pattern.exec(request.url)

				return route.handler(request, parameters)
			}
		}

		return new Response(null, { status: Status.NotFound })
	}
}
