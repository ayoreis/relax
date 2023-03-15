/** https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods */
type Method =
	| 'GET'
	| 'HEAD'
	| 'POST'
	| 'PUT'
	| 'DELETE'
	| 'CONNECT'
	| 'OPTIONS'
	| 'TRACE'
	| 'PATCH';

type Handler = (
	request: Request,
	groups: URLPatternComponentResult['groups'],
) => Promise<Response> | Response;

export class Router {
	readonly #routes: Record<
		Method,
		{ urlPattern: URLPattern; handler: Handler }[]
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
	};

	add(method: Method, pathname: string, handler: Handler) {
		const urlPattern = new URLPattern({ pathname });

		this.#routes[method].push({ urlPattern, handler });
	}

	handle = async (request: Request) => {
		const method = request.method as Method;
		const { pathname } = new URL(request.url);

		for (const route of this.#routes[method]) {
			if (!route.urlPattern.test({ pathname })) continue;

			const { pathname: { groups } } = route.urlPattern
				.exec({ pathname })!;

			return await route.handler(request, groups);
		}
	};
}
