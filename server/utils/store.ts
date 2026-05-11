import { db } from '../db/connection.js';
import type { Store } from '../db/database-types.js';

export async function getStoreForUser(userId: string): Promise<Store | null> {
	const store = await db
		.selectFrom('stores')
		.selectAll()
		.where('user_id', '=', userId)
		.executeTakeFirst();

	return store ?? null;
}
