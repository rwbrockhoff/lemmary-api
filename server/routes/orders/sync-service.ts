import { sql, type Transaction, type SqlBool } from 'kysely';
import { db } from '../../db/connection.js';
import type { Database } from '../../db/database-types.js';
import {
	getStoreWithAccessToken,
	getShopDomain,
	type StoreWithAccessToken,
} from '../../utils/store.js';
import { toJsonb } from '../../utils/json.js';
import { recordAuditEvent } from '../../utils/audit-logger.js';
import { AuditAction } from '../../db/enums.js';
import { getDefaultStageIds } from './utils/default-stages.js';
import { fetchSquarespaceOrders } from './platforms/squarespace.js';
import { fetchShopifyOrders } from './platforms/shopify.js';
import type { NormalizedOrder } from './platforms/order-types.js';

async function fetchOrdersFromPlatform(
	store: StoreWithAccessToken,
): Promise<NormalizedOrder[]> {
	if (store.platform === 'squarespace') {
		return fetchSquarespaceOrders(store.access_token, store.last_synced_at);
	}

	if (store.platform === 'shopify') {
		return fetchShopifyOrders(
			getShopDomain(store),
			store.access_token,
			store.last_synced_at,
		);
	}

	throw new Error(`Unsupported platform: ${store.platform}`);
}

function calculateDueDate(
	orderDate: Date,
	leadTimeDays: number | null,
): string | null {
	if (!leadTimeDays) return null;
	const due = new Date(orderDate);
	due.setDate(due.getDate() + leadTimeDays);
	return due.toISOString().slice(0, 10);
}

// Reconciles customer's order workflow stage to be completed when
// order is synced to platform and flag changes from pending -> complete

export async function reconcileCompletedOrderStages(
	trx: Transaction<Database>,
	storeId: string,
) {
	const finalStage = await trx
		.selectFrom('order_workflow_stages')
		.select('id')
		.where('store_id', '=', storeId)
		.where('is_complete', '=', true)
		.executeTakeFirst();

	// store has no complete stage configured - return early
	if (!finalStage) return 0;

	const outOfSyncOrders = await trx
		.selectFrom('orders')
		.select(['id', 'workflow_stage_id', 'fulfilled_at'])
		.where('store_id', '=', storeId)
		.where('fulfillment_status', '=', 'fulfilled')
		.where(sql<SqlBool>`workflow_stage_id is distinct from ${finalStage.id}`)
		.execute();

	// no orders out of sync - return early
	if (outOfSyncOrders.length === 0) return 0;

	await trx
		.updateTable('orders')
		.set({ workflow_stage_id: finalStage.id, updated_at: sql`NOW()` })
		.where(
			'id',
			'in',
			outOfSyncOrders.map((o) => o.id),
		)
		.execute();

	await trx
		.insertInto('order_stage_history')
		.values(
			outOfSyncOrders.map((o) => ({
				order_id: o.id,
				from_stage_id: o.workflow_stage_id,
				to_stage_id: finalStage.id,
				transitioned_at: o.fulfilled_at ?? new Date(),
			})),
		)
		.execute();

	// reconcile order items to the complete stage too
	const finalItemStage = await trx
		.selectFrom('order_item_workflow_stages')
		.select('id')
		.where('store_id', '=', storeId)
		.where('is_complete', '=', true)
		.executeTakeFirst();

	if (finalItemStage) {
		await trx
			.updateTable('order_items')
			.set({ workflow_stage_id: finalItemStage.id, updated_at: sql`NOW()` })
			.where(
				sql<SqlBool>`order_id in (
					select id from orders
					where store_id = ${storeId} and workflow_stage_id = ${finalStage.id}
				)`,
			)
			.where(
				sql<SqlBool>`workflow_stage_id is distinct from ${finalItemStage.id}`,
			)
			.execute();
	}

	// return total # of orders updated to is_complete workflow stage
	return outOfSyncOrders.length;
}

async function upsertOrders(
	storeId: string,
	orders: NormalizedOrder[],
	leadTimeDays: number | null,
) {
	const { orderStageId, itemStageId } = await getDefaultStageIds(storeId);

	return db.transaction().execute(async (trx) => {
		let synced = 0;

		for (const { order, items } of orders) {
			const dueDate = calculateDueDate(order.order_date, leadTimeDays);

			const result = await trx
				.insertInto('orders')
				.values({
					...order,
					store_id: storeId,
					workflow_stage_id: orderStageId,
					due_date: dueDate,
				})
				.onConflict((oc) =>
					oc
						.columns(['store_id', 'platform_order_id'])
						// Only matches platform orders
						.where('platform_order_id', 'is not', null)
						.doUpdateSet({
							customer_name: order.customer_name,
							customer_email: order.customer_email,
							fulfillment_status: order.fulfillment_status,
							subtotal: order.subtotal,
							shipping_total: order.shipping_total,
							grand_total: order.grand_total,
							shipping_method: order.shipping_method,
							fulfilled_at: order.fulfilled_at,
							tracking_number: order.tracking_number,
							tracking_url: order.tracking_url,
							carrier_name: order.carrier_name,
							promo_code: order.promo_code,
							discount_total: order.discount_total,
							workflow_stage_id: sql`COALESCE(orders.workflow_stage_id, EXCLUDED.workflow_stage_id)`,
							updated_at: sql`NOW()`,
						}),
				)
				.returning('id')
				.executeTakeFirstOrThrow();

			if (items.length > 0) {
				// EXCLUDED.column refers to each row's proposed values on conflict
				await trx
					.insertInto('order_items')
					.values(
						items.map((item) => ({
							...item,
							variant_label: toJsonb(item.variant_label),
							order_id: result.id,
							workflow_stage_id: itemStageId,
						})),
					)
					.onConflict((oc) =>
						oc.columns(['order_id', 'platform_line_item_id']).doUpdateSet({
							product_name: (eb) => eb.ref('excluded.product_name'),
							variant_label: (eb) => eb.ref('excluded.variant_label'),
							quantity: (eb) => eb.ref('excluded.quantity'),
							unit_price: (eb) => eb.ref('excluded.unit_price'),
							image_url: (eb) => eb.ref('excluded.image_url'),
							workflow_stage_id: sql`COALESCE(order_items.workflow_stage_id, EXCLUDED.workflow_stage_id)`,
							updated_at: sql`NOW()`,
						}),
					)
					.execute();
			}

			synced++;
		}

		await reconcileCompletedOrderStages(trx, storeId);

		return synced;
	});
}

export async function syncOrders(userId: string) {
	const store = await getStoreWithAccessToken(userId);
	if (!store) return null;

	const syncStartedAt = new Date();
	const orders = await fetchOrdersFromPlatform(store);
	const synced = await upsertOrders(store.id, orders, store.lead_time_days);

	await db
		.updateTable('stores')
		.set({ last_synced_at: syncStartedAt })
		.where('id', '=', store.id)
		.execute();

	// Record in audit log
	if (synced > 0) {
		await recordAuditEvent({
			action: AuditAction.PiiSynced,
			platform: store.platform,
			storeId: store.id,
			userId: store.user_id,
			metadata: { orders: synced },
		});
	}

	return { synced, storeId: store.id };
}
