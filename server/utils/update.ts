// Copies a value onto a partial update object only when the caller provided it
export function setColumn<T, K extends keyof T>(
	target: T,
	key: K,
	value: T[K] | undefined,
) {
	if (value !== undefined) target[key] = value;
}
