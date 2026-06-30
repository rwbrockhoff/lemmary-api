// Treats empty strings as null so optional text fields store cleanly
export function emptyToNull(value: string | null | undefined): string | null {
	return value ? value : null;
}

// Runs the transform if value is present, returns null otherwise
export function applyOrNull<T, U>(
	value: T | null | undefined,
	fn: (value: T) => U,
): U | null {
	if (value === null || value === undefined) return null;
	return fn(value);
}
