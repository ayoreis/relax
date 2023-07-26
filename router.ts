/** https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods */
type Method = typeof METHODS[number];
type Groups = URLPatternComponentResult['groups'];
type MaybePromise<Type> = Type | Promise<Type>;

type ResponseGenerator =
	| Generator<void, Response | void, Response>
	| AsyncGenerator<void, Response | void, Response>;

type Handler<Type = MaybePromise<Response> | ResponseGenerator> = (
	request: Request,
	groups: Groups,
) => Type;

const METHODS = [
	'GET',
	'HEAD',
	'POST',
	'PUT',
	'DELETE',
	'CONNECT',
	'OPTIONS',
	'TRACE',
	'PATCH',
] as const;

const GeneratorFunction = function* () {}
	.constructor as GeneratorFunctionConstructor;
const AsyncGeneratorFunction = async function* () {}
	.constructor as AsyncGeneratorFunctionConstructor;

class Route<Type extends Handler = Handler> {
	constructor(
		public pattern: URLPattern,
		public handler: Type,
	) {}
}

export class Router {
	#routes: Record<
		Method,
		Route[]
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

	#add(
		method: Method,
		pathname: string,
		handler: Handler,
	) {
		const route = new Route(
			new URLPattern({ pathname }),
			handler,
		);

		this.#routes[method].push(route);

		return this;
	}

	any(pathname: string, handler: Handler<ResponseGenerator>): this;
	any(pathname: string, handler: Handler<MaybePromise<Response>>): this;
	any(pathname: string, handler: Handler) {
		for (const method of METHODS) {
			this.#add(method, pathname, handler);
		}

		return this;
	}

	get(pathname: string, handler: Handler<ResponseGenerator>): this;
	get(pathname: string, handler: Handler<MaybePromise<Response>>): this;
	get(pathname: string, handler: Handler) {
		return this.#add('GET', pathname, handler);
	}

	head(pathname: string, handler: Handler<ResponseGenerator>): this;
	head(pathname: string, handler: Handler<MaybePromise<Response>>): this;
	head(pathname: string, handler: Handler) {
		return this.#add('HEAD', pathname, handler);
	}

	post(pathname: string, handler: Handler<ResponseGenerator>): this;
	post(pathname: string, handler: Handler<MaybePromise<Response>>): this;
	post(pathname: string, handler: Handler) {
		return this.#add('POST', pathname, handler);
	}

	put(pathname: string, handler: Handler<ResponseGenerator>): this;
	put(pathname: string, handler: Handler<MaybePromise<Response>>): this;
	put(pathname: string, handler: Handler) {
		return this.#add('PUT', pathname, handler);
	}

	delete(pathname: string, handler: Handler<ResponseGenerator>): this;
	delete(pathname: string, handler: Handler<MaybePromise<Response>>): this;
	delete(pathname: string, handler: Handler) {
		return this.#add('DELETE', pathname, handler);
	}

	connect(pathname: string, handler: Handler<ResponseGenerator>): this;
	connect(pathname: string, handler: Handler<MaybePromise<Response>>): this;
	connect(pathname: string, handler: Handler) {
		return this.#add('CONNECT', pathname, handler);
	}

	options(pathname: string, handler: Handler<ResponseGenerator>): this;
	options(pathname: string, handler: Handler<MaybePromise<Response>>): this;
	options(pathname: string, handler: Handler) {
		return this.#add('OPTIONS', pathname, handler);
	}

	trace(pathname: string, handler: Handler<ResponseGenerator>): this;
	trace(pathname: string, handler: Handler<MaybePromise<Response>>): this;
	trace(pathname: string, handler: Handler) {
		return this.#add('TRACE', pathname, handler);
	}

	patch(pathname: string, handler: Handler<ResponseGenerator>): this;
	patch(pathname: string, handler: Handler<MaybePromise<Response>>): this;
	patch(pathname: string, handler: Handler) {
		return this.#add('PATCH', pathname, handler);
	}

	async #handle(request: Request, index = 0): Promise<Response> {
		const route = this.#routes[request.method as Method][index];

		if (typeof route === 'undefined') {
			throw TypeError(index > 0 ? 'No more handlers' : 'No handlers');
		}

		const { pathname } = new URL(request.url);
		const { pattern, handler } = route;

		if (!pattern.test({ pathname })) {
			return this.#handle(request, ++index);
		}

		const { groups } = pattern.exec({ pathname })!.pathname;

		if (
			!(handler instanceof GeneratorFunction ||
				handler instanceof AsyncGeneratorFunction)
		) {
			return handler(
				request,
				groups,
			) as MaybePromise<Response>;
		}

		const generator = handler(
			request,
			groups,
		) as ResponseGenerator;

		let { value, done } = await generator.next();

		if (!done) {
			const response = await this.#handle(request, ++index);

			({ value = response, done } = await generator.next(response!));
		}

		if (!done) {
			throw TypeError('Yielded more than once');
		}

		return value!;
	}

	handler = async (request: Request) => {
		return await this.#handle(request);
	};
}

// TODO handle vs serve vs handler vs fetch vs route
// TODO pathname vs path vs pattern
