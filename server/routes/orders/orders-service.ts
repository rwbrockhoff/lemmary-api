import { sql } from 'kysely';
import { db } from '../../db/connection.js';
import type { Store } from '../../db/database-types.js';
import { getStoreForUser } from '../../utils/store.js';
import { toJsonb } from '../../utils/json.js';
import {
	fetchSquarespaceOrders,
	type NormalizedOrder,
} from './platforms/squarespace.js';

async function fetchOrdersFromPlatform(
	store: Store,
): Promise<NormalizedOrder[]> {
	if (store.platform === 'squarespace') {
		return fetchSquarespaceOrders(store.api_key, store.last_synced_at);
	}

	throw new Error(`Unsupported platform: ${store.platform}`);
}

async function getDefaultStageIds(storeId: string) {
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

function calculateDueDate(orderDate: Date, leadTimeDays: number | null): Date | null {
	if (!leadTimeDays) return null;
	const due = new Date(orderDate);
	due.setDate(due.getDate() + leadTimeDays);
	return due;
}

async function upsertOrders(storeId: string, orders: NormalizedOrder[], leadTimeDays: number | null) {
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
					oc.columns(['store_id', 'platform_order_id']).doUpdateSet({
						customer_name: order.customer_name,
						customer_email: order.customer_email,
						fulfillment_status: order.fulfillment_status,
						subtotal: order.subtotal,
						shipping_total: order.shipping_total,
						grand_total: order.grand_total,
						shipping_method: order.shipping_method,
						order_url: order.order_url,
						updated_at: new Date(),
					}),
				)
				.returning('id')
				.executeTakeFirstOrThrow();

			if (items.length > 0) {
				for (const item of items) {
					const variantJson = toJsonb(item.variant_label);

					await trx
						.insertInto('order_items')
						.values({
							...item,
							variant_label: variantJson,
							order_id: result.id,
							workflow_stage_id: itemStageId,
						})
						.onConflict((oc) =>
							oc
								.columns(['order_id', 'platform_line_item_id'])
								.doUpdateSet({
									product_name: item.product_name,
									variant_label: variantJson,
									quantity: item.quantity,
									unit_price: item.unit_price,
									image_url: item.image_url,
									updated_at: new Date(),
								}),
						)
						.execute();
				}
			}

			synced++;
		}

		return synced;
	});
}

export async function syncOrders(userId: string) {
	const store = await getStoreForUser(userId);
	const orders = await fetchOrdersFromPlatform(store);
	const synced = await upsertOrders(store.id, orders, store.lead_time_days);

	await db
		.updateTable('stores')
		.set({ last_synced_at: new Date() })
		.where('id', '=', store.id)
		.execute();

	return { synced, storeId: store.id };
}

export async function getOrders(userId: string) {
	const store = await getStoreForUser(userId);

	const orders = await db
		.selectFrom('orders')
		.selectAll('orders')
		.leftJoin(
			'order_workflow_stages',
			'order_workflow_stages.id',
			'orders.workflow_stage_id',
		)
		.select([
			sql<string>`(select count(*) from order_items where order_items.order_id = orders.id)`.as('item_count'),
			sql<string>`(select count(*) from order_items join order_item_workflow_stages on order_item_workflow_stages.id = order_items.workflow_stage_id where order_items.order_id = orders.id and order_item_workflow_stages.is_complete = true)`.as('items_completed'),
			'order_workflow_stages.name as workflow_stage_name',
			'order_workflow_stages.color as workflow_stage_color',
		])
		.where('orders.store_id', '=', store.id)
		.where('orders.fulfillment_status', '=', 'pending')
		.orderBy('order_date', 'desc')
		.execute();

	return {
		orders: orders.map((row) => ({
			...row,
			item_count: Number(row.item_count),
			items_completed: Number(row.items_completed),
		})),
		lastSyncedAt: store.last_synced_at,
	};
}

export async function getOrderWithItems(userId: string, orderId: string) {
	const store = await getStoreForUser(userId);

	const order = await db
		.selectFrom('orders')
		.selectAll('orders')
		.leftJoin(
			'order_workflow_stages',
			'order_workflow_stages.id',
			'orders.workflow_stage_id',
		)
		.select('order_workflow_stages.name as workflow_stage_name')
		.where('orders.id', '=', orderId)
		.where('orders.store_id', '=', store.id)
		.executeTakeFirst();

	if (!order) return null;

	const items = await db
		.selectFrom('order_items')
		.selectAll('order_items')
		.leftJoin(
			'order_item_workflow_stages',
			'order_item_workflow_stages.id',
			'order_items.workflow_stage_id',
		)
		.select('order_item_workflow_stages.name as workflow_stage_name')
		.where('order_id', '=', order.id)
		.orderBy('order_items.created_at', 'asc')
		.orderBy('order_items.id', 'asc')
		.execute();

	return { ...order, items };
}

export async function getWorkflowStages(userId: string) {
	const store = await getStoreForUser(userId);

	const orderStages = await db
		.selectFrom('order_workflow_stages')
		.selectAll()
		.where('store_id', '=', store.id)
		.orderBy('position', 'asc')
		.execute();

	const itemStages = await db
		.selectFrom('order_item_workflow_stages')
		.selectAll()
		.where('store_id', '=', store.id)
		.orderBy('position', 'asc')
		.execute();

	return { orderStages, itemStages };
}

export async function updateOrderStage(
	userId: string,
	orderId: string,
	stageId: string,
) {
	const store = await getStoreForUser(userId);

	return db
		.updateTable('orders')
		.set({ workflow_stage_id: stageId, updated_at: new Date() })
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.returningAll()
		.executeTakeFirst();
}

export async function updateOrderNotes(
	userId: string,
	orderId: string,
	notes: string,
) {
	const store = await getStoreForUser(userId);

	return db
		.updateTable('orders')
		.set({ order_notes: notes, updated_at: new Date() })
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.returningAll()
		.executeTakeFirst();
}

function workflowOrdersBase(storeId: string) {
	return db
		.selectFrom('orders')
		.selectAll('orders')
		.leftJoin(
			'order_workflow_stages',
			'order_workflow_stages.id',
			'orders.workflow_stage_id',
		)
		.select([
			sql<string>`(select count(*) from order_items where order_items.order_id = orders.id)`.as('item_count'),
			'order_workflow_stages.name as workflow_stage_name',
			'order_workflow_stages.color as workflow_stage_color',
			sql<string | null>`(
				select pb.name
				from production_batch_orders pbo
				inner join production_batches pb on pb.id = pbo.batch_id
				where pbo.order_id = orders.id
				and pb.status = 'Active'
				order by pb.created_at desc
				limit 1
			)`.as('batch_name'),
			sql<string | null>`(
				select pb.id
				from production_batch_orders pbo
				inner join production_batches pb on pb.id = pbo.batch_id
				where pbo.order_id = orders.id
				and pb.status = 'Active'
				order by pb.created_at desc
				limit 1
			)`.as('batch_id'),
		])
		.where('orders.store_id', '=', storeId)
		.where('orders.fulfillment_status', '=', 'pending');
}

export async function getWorkflowBoard(userId: string) {
	const store = await getStoreForUser(userId);

	const openOrders = await workflowOrdersBase(store.id)
		.where('order_workflow_stages.is_complete', '!=', true)
		.orderBy('order_date', 'asc')
		.execute();

	const completedOrders = await workflowOrdersBase(store.id)
		.where('order_workflow_stages.is_complete', '=', true)
		.orderBy('orders.updated_at', 'desc')
		.limit(10)
		.execute();

	const orders = [...openOrders, ...completedOrders];

	const stages = await db
		.selectFrom('order_workflow_stages')
		.selectAll()
		.where('store_id', '=', store.id)
		.orderBy('position', 'asc')
		.execute();

	const activeBatches = await db
		.selectFrom('production_batches')
		.select(['id', 'name'])
		.where('store_id', '=', store.id)
		.where('status', '=', 'Active')
		.orderBy('created_at', 'desc')
		.execute();

	return {
		orders: orders.map((row) => ({
			...row,
			item_count: Number(row.item_count),
		})),
		stages,
		activeBatches,
	};
}

export async function updateOrderItemStage(
	userId: string,
	orderId: string,
	itemId: string,
	stageId: string,
) {
	const store = await getStoreForUser(userId);

	const order = await db
		.selectFrom('orders')
		.select('id')
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!order) return null;

	return db
		.updateTable('order_items')
		.set({ workflow_stage_id: stageId, updated_at: new Date() })
		.where('id', '=', itemId)
		.where('order_id', '=', orderId)
		.returningAll()
		.executeTakeFirst();
}
