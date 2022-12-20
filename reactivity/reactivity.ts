type Key = string | number | symbol
type Target = Record<Key, unknown>

const effectWatchers = new WeakMap<Target, Map<Key, Set<() => void>>>()

let activeEffect: (() => void) | null = null

function getSubscribersForProperty(target: Target, key: Key) {
	if (!effectWatchers.has(target)) effectWatchers.set(target, new Map())

	if (!effectWatchers.get(target)!.has(key))
		effectWatchers.get(target)!.set(key, new Set())

	return effectWatchers.get(target)!.get(key)!
}

export function track(target: Target, key: Key) {
	if (!activeEffect) return

	const watchers = getSubscribersForProperty(target, key)
	watchers.add(activeEffect)
}

export function trigger(target: Target, key: Key) {
	const effects = getSubscribersForProperty(target, key)

	for (const effect of effects) effect()
}

export function object<Type extends Target>(obj: Type) {
	return new Proxy(obj, {
		get(target, key) {
			track(target, key)

			return Reflect.get(target, key)
		},

		set(target, key, value, receiver) {
			trigger(target, key)

			return Reflect.set(target, key, value, receiver)
		},
	})
}

export function variable<Type>(value: Type) {
	return {
		get value() {
			track(this, 'value')
			return value
		},

		set value(newValue) {
			value = newValue
			trigger(this, 'value')
		},
	}
}

export function watchEffect(update: () => void) {
	async function effect() {
		activeEffect = effect
		await update()
		activeEffect = null
	}

	effect()
}
