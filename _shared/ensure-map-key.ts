import { KeyOfMap, ValueOfMap } from '../_shared/types.ts'

export function ensureMapKey<
	TheMap extends Map<unknown, unknown>,
>(
	map: TheMap,
	key: KeyOfMap<TheMap>,
	value: ValueOfMap<TheMap>,
) {
	if (map.has(key)) return

	map.set(key, value)

	return value
}
