/** https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods */
type Method = typeof METHODS[number];
type Groups = URLPatternComponentResult['groups'];
type MaybePromise<Type> = Type | Promise<Type>;

type GeneratorResponse =
	| Generator<void, Response | void, Response>
	| AsyncGenerator<void, Response | void, Response>;

type Handler<Type = MaybePromise<Response> | GeneratorResponse> = (
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
		pattern: string,
		handler: Handler,
	) {
		const route = new Route(
			new URLPattern({ pathname: pattern }),
			handler,
		);

		this.#routes[method].push(route);

		return this;
	}

	any(pattern: string, handler: Handler<GeneratorResponse>): this;
	any(pattern: string, handler: Handler<MaybePromise<Response>>): this;
	any(pattern: string, handler: Handler) {
		const route = new Route(
			new URLPattern({ pathname: pattern }),
			handler,
		);

		for (const method of METHODS) {
			this.#routes[method].push(route);
		}

		return this;
	}

	get(pattern: string, handler: Handler<GeneratorResponse>): this;
	get(pattern: string, handler: Handler<MaybePromise<Response>>): this;
	get(pattern: string, handler: Handler) {
		return this.#add('GET', pattern, handler);
	}

	head(pattern: string, handler: Handler<GeneratorResponse>): this;
	head(pattern: string, handler: Handler<MaybePromise<Response>>): this;
	head(pattern: string, handler: Handler) {
		return this.#add('HEAD', pattern, handler);
	}

	post(pattern: string, handler: Handler<GeneratorResponse>): this;
	post(pattern: string, handler: Handler<MaybePromise<Response>>): this;
	post(pattern: string, handler: Handler) {
		return this.#add('POST', pattern, handler);
	}

	put(pattern: string, handler: Handler<GeneratorResponse>): this;
	put(pattern: string, handler: Handler<MaybePromise<Response>>): this;
	put(pattern: string, handler: Handler) {
		return this.#add('PUT', pattern, handler);
	}

	delete(pattern: string, handler: Handler<GeneratorResponse>): this;
	delete(pattern: string, handler: Handler<MaybePromise<Response>>): this;
	delete(pattern: string, handler: Handler) {
		return this.#add('DELETE', pattern, handler);
	}

	connect(pattern: string, handler: Handler<GeneratorResponse>): this;
	connect(pattern: string, handler: Handler<MaybePromise<Response>>): this;
	connect(pattern: string, handler: Handler) {
		return this.#add('CONNECT', pattern, handler);
	}

	options(pattern: string, handler: Handler<GeneratorResponse>): this;
	options(pattern: string, handler: Handler<MaybePromise<Response>>): this;
	options(pattern: string, handler: Handler) {
		return this.#add('OPTIONS', pattern, handler);
	}

	trace(pattern: string, handler: Handler<GeneratorResponse>): this;
	trace(pattern: string, handler: Handler<MaybePromise<Response>>): this;
	trace(pattern: string, handler: Handler) {
		return this.#add('TRACE', pattern, handler);
	}

	patch(pattern: string, handler: Handler<GeneratorResponse>): this;
	patch(pattern: string, handler: Handler<MaybePromise<Response>>): this;
	patch(pattern: string, handler: Handler) {
		return this.#add('PATCH', pattern, handler);
	}

	async #handle(request: Request, index = 0): Promise<Response> {
		const route = this.#routes[request.method as Method][index];

		const { pathname } = new URL(request.url);
		const { pattern, handler } = route;

		if (!pattern.test({ pathname })) {
			if (
				typeof this.#routes[request.method as Method][index + 1] ===
					'undefined'
			) {
				throw new TypeError('No matching handlers');
			}

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
		) as GeneratorResponse;

		let { value, done } = await generator.next();

		if (!done) {
			if (
				typeof this.#routes[request.method as Method][index + 1] ===
					'undefined'
			) {
				await generator.throw(new TypeError('No matching handlers'));
			}

			const response = await this.#handle(request, ++index);

			({ value = response, done } = await generator.next(
				response!,
			));
		}

		if (!done) {
			await generator.throw(new TypeError('Yielded more than once'));
		}

		return value!;
	}

	handler = async (request: Request) => {
		if (this.#routes[request.method as Method].length <= 0) {
			throw new TypeError('No handlers');
		}

		return await this.#handle(request);
	};
}
