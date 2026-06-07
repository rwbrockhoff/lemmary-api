import { sql } from 'kysely';
import type { Transaction } from 'kysely';
import type { Database } from '../../../db/database-types.js';
import { toJsonb } from '../../../utils/json.js';
import type { UpdateCustomOrderItem } from '../contract/types.js';

// Handles updates to custom order linte items
// Adds new items, deleted removed items, and preserves item stage
// when user swaps to different product or variant (if in progress)

export async function syncCustomOrderItems(
	trx: Transaction<Database>,
	orderId: string,
	items: UpdateCustomOrderItem[],
	itemStageId: string | null,
) {
	const existing = await trx
		.selectFrom('order_items')
		.select('id')
		.where('order_id', '=', orderId)
		.execute();

	const existingIds = new Set(existing.map((item) => item.id));
	const incomingIds = new Set(
		items.filter((item) => item.id).map((item) => item.id),
	);

	// Delete removed items
	const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id));
	if (idsToDelete.length > 0) {
		await trx
			.deleteFrom('order_items')
			.where('id', 'in', idsToDelete)
			.execute();
	}

	// Insert new items
	const newItems = items.filter((item) => !item.id);
	if (newItems.length > 0) {
		await trx
			.insertInto('order_items')
			.values(
				newItems.map((item) => ({
					order_id: orderId,
					product_name: item.product_name,
					platform_sku: item.platform_sku ?? null,
					variant_label: toJsonb(item.variant_label ?? null),
					image_url: item.image_url ?? null,
					quantity: item.quantity,
					unit_price: item.unit_price ?? null,
					workflow_stage_id: itemStageId,
				})),
			)
			.execute();
	}

	// Update items that have changed product or variant (preserves stage)
	const itemsToUpdate = items.filter(
		(item): item is UpdateCustomOrderItem & { id: string } =>
			item.id !== undefined && existingIds.has(item.id),
	);

	if (itemsToUpdate.length > 0) {
		await trx
			.insertInto('order_items')
			.values(
				itemsToUpdate.map((item) => ({
					id: item.id,
					order_id: orderId,
					product_name: item.product_name,
					platform_sku: item.platform_sku ?? null,
					variant_label: toJsonb(item.variant_label ?? null),
					image_url: item.image_url ?? null,
					quantity: item.quantity,
					unit_price: item.unit_price ?? null,
				})),
			)
			.onConflict((oc) =>
				// Intentionally keeps existing stage
				oc.column('id').doUpdateSet((eb) => ({
					product_name: eb.ref('excluded.product_name'),
					platform_sku: eb.ref('excluded.platform_sku'),
					variant_label: eb.ref('excluded.variant_label'),
					image_url: eb.ref('excluded.image_url'),
					quantity: eb.ref('excluded.quantity'),
					unit_price: eb.ref('excluded.unit_price'),
					updated_at: sql`NOW()`,
				})),
			)
			.execute();
	}
}
