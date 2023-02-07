export type MaybePromise<Type> = Promise<Type> | Type

export type KeyOfMap<TheMap extends Map<unknown, unknown>> =
	TheMap extends Map<infer Key, unknown> ? Key : never

export type ValueOfMap<
	TheMap extends Map<unknown, unknown>,
> = TheMap extends Map<unknown, infer Value> ? Value : never
