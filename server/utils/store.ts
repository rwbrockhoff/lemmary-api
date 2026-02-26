import { db } from '../db/connection.js';
import type { Store } from '../db/database-types.js';

export async function getStoreForUser(userId: string): Promise<Store> {
	const store = await db
		.selectFrom('stores')
		.selectAll()
		.where('user_id', '=', userId)
		.executeTakeFirst();

	if (!store) {
		throw new Error('No store found for user');
	}

	return store;
}
