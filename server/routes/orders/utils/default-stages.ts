import { db } from '../../../db/connection.js';

export async function getDefaultStageIds(storeId: string) {
	const orderStage = await db
		.selectFrom('order_workflow_stages')
		.select('id')
		.where('store_id', '=', storeId)
		.where('is_default', '=', true)
		.executeTakeFirst();

	const itemStage = await db
		.selectFrom('order_item_workflow_stages')
		.select('id')
		.where('store_id', '=', storeId)
		.where('is_default', '=', true)
		.executeTakeFirst();

	return {
		orderStageId: orderStage?.id ?? null,
		itemStageId: itemStage?.id ?? null,
	};
}
