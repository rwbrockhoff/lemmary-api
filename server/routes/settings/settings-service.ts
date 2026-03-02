import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';

export async function getStoreSettings(userId: string) {
	const store = await getStoreForUser(userId);

	return {
		storeName: store.store_name,
		platform: store.platform,
		leadTimeDays: store.lead_time_days,
	};
}

export async function updateLeadTime(userId: string, leadTimeDays: number | null) {
	const store = await getStoreForUser(userId);

	await db
		.updateTable('stores')
		.set({ lead_time_days: leadTimeDays, updated_at: new Date() })
		.where('id', '=', store.id)
		.execute();

	return { leadTimeDays };
}
