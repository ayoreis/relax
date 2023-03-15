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
) => Promise<Response> | Response;

export class Router {
	readonly #routes: Record<
		Method,
		{ pathname: string; handler: Handler }[]
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
		this.#routes[method].push({ pathname, handler });
	}

	handle = async (request: Request) => {
		const method = request.method as Method;
		const { pathname } = new URL(request.url);

		for (const route of this.#routes[method]) {
			if (route.pathname !== pathname) continue;

			return await route.handler(request);
		}
	};
}
