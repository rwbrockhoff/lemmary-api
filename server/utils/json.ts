import { RawBuilder, sql } from 'kysely';

export function toJsonb<T>(value: T | null): RawBuilder<T> | null {
	if (value == null) return null;
	return sql`${JSON.stringify(value)}::jsonb`;
}
