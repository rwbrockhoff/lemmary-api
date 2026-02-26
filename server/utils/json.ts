export function toJsonb<T>(value: T | null): string | null {
	if (value == null) return null;
	return JSON.stringify(value) as any;
}
