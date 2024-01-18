type Pattern = string | URLPattern
type Groups = URLPatternComponentResult['groups']
type MaybePromise<Type> = Type | Promise<Type>
type Handler = (request: Request, groups: Groups) => MaybePromise<Response>
type $404Handler = (request: Request) => MaybePromise<Response>

type Method = 'GET'

export class Router {
	#routes: Record<Method, [URLPattern, Handler][]> = {
		GET: [],
	}

	#$404?: $404Handler

	#add_route(method: Method, pattern: Pattern, handler: Handler) {
		if (!(pattern instanceof URLPattern)) {
			pattern = new URLPattern({ pathname: pattern })
		}

		this.#routes[method].push([pattern, handler])

		return this
	}

	get(pattern: Pattern, handler: Handler) {
		return this.#add_route('GET', pattern, handler)
	}

	$404(handler: $404Handler) {
		this.#$404 = handler

		return this
	}

	async handle(request: Request) {
		const method = request.method as Method
		const { pathname } = new URL(request.url)

		for (const [pattern, handler] of this.#routes[method]) {
			if (!pattern.test({ pathname })) continue

			const groups = pattern.exec({ pathname })!.pathname.groups

			return await handler(request, groups)
		}

		return this.#$404?.(request) ?? new Response(null, { status: 404 })
	}
}
