let activeEffect = null
const subscribers = new WeakMap()

function getSubscribersForProperty(target, key) {
	if (!subscribers.has(target)) {
		subscribers.set(target, new Map())
	}

	if (!subscribers.get(target).has(key)) {
		subscribers.get(target).set(key, new Set())
	}

	return subscribers.get(target).get(key)
}

function track(target, key) {
	if (activeEffect) {
		const effects = getSubscribersForProperty(target, key)
		effects.add(activeEffect)
	}
}

function trigger(target, key) {
	const effects = getSubscribersForProperty(target, key)
	effects.forEach(effect => effect())
}

export function reactive(object) {
	return new Proxy(object, {
		get(target, key) {
			track(target, key)
			return target[key]
		},
		set(target, key, value) {
			target[key] = value
			trigger(target, key)
			return true
		},
	})
}

export function effect(callback) {
	const effect = () => {
		activeEffect = effect
		callback()
		activeEffect = null
	}

	effect()
}
