import type { MaybePromise } from '../_shared/types.ts'

type Target = <Type>(newValue: Type) => Type
type Key = string | number | symbol
type Effect = () => void

const effectSubscribers = new WeakMap<
	Target,
	Map<Key, Set<Effect>>
>()

let activeEffect: Effect | null = null

function getSubscribersForProperty(
	target: Target,
	key: Key,
) {
	if (!effectSubscribers.has(target)) {
		effectSubscribers.set(target, new Map())
	}

	if (!effectSubscribers.get(target)!.has(key)) {
		effectSubscribers.get(target)!.set(key, new Set())
	}

	return effectSubscribers.get(target)!.get(key)!
}

export function track(target: Target, key: Key) {
	if (!activeEffect) return

	const effects = getSubscribersForProperty(target, key)
	effects.add(activeEffect)
}

export function trigger(target: Target, key: Key) {
	const effects = getSubscribersForProperty(target, key)

	for (const effect of effects) effect()
}

function reactive<Type>(
	initialValue: Type,
) {
	let value = initialValue

	const foo = ((
		newValue,
	): Type => {
		trigger(foo as Target, 'value')

		return value = newValue
	}) as Type & ((newType: Type) => Type)
	;(foo as Record<symbol, () => Type>)[
		Symbol.toPrimitive
	] = () => {
		track(foo as Target, 'value')

		return value
	}

	return foo
}

export async function effect(
	update: () => MaybePromise<void>,
) {
	async function effect() {
		activeEffect = effect
		await update()
		activeEffect = null
	}

	await effect()
}
