import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';

export async function getStoreSettings(userId: string) {
	const store = await getStoreForUser(userId);
	if (!store) {
		return {
			storeName: null,
			platform: null,
			leadTimeDays: null,
			storeUrl: null,
		};
	}

	const platformConfig = (store.platform_config ?? {}) as {
		store_url?: string | null;
	};

	return {
		storeName: store.store_name,
		platform: store.platform,
		leadTimeDays: store.lead_time_days,
		storeUrl: platformConfig.store_url ?? null,
	};
}

export async function updateLeadTime(
	userId: string,
	leadTimeDays: number | null,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	await db
		.updateTable('stores')
		.set({ lead_time_days: leadTimeDays, updated_at: new Date() })
		.where('id', '=', store.id)
		.execute();

	return { leadTimeDays };
}
