import { sql } from 'kysely';
import { db } from '../../db/connection.js';
import {
	getStoreForUser,
	getStoreWithAccessToken,
	type StoreWithAccessToken,
} from '../../utils/store.js';
import { toJsonb } from '../../utils/json.js';
import {
	fetchSquarespaceOrders,
	type NormalizedOrder,
} from './platforms/squarespace.js';

async function fetchOrdersFromPlatform(
	store: StoreWithAccessToken,
): Promise<NormalizedOrder[]> {
	if (store.platform === 'squarespace') {
		const storeUrl =
			(store.platform_config as { store_url?: string | null } | null)
				?.store_url ?? null;
		return fetchSquarespaceOrders(
			store.access_token,
			store.last_synced_at,
			storeUrl,
		);
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

function calculateDueDate(
	orderDate: Date,
	leadTimeDays: number | null,
): Date | null {
	if (!leadTimeDays) return null;
	const due = new Date(orderDate);
	due.setDate(due.getDate() + leadTimeDays);
	return due;
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
					oc.columns(['store_id', 'platform_order_id']).doUpdateSet({
						customer_name: order.customer_name,
						customer_email: order.customer_email,
						fulfillment_status: order.fulfillment_status,
						subtotal: order.subtotal,
						shipping_total: order.shipping_total,
						grand_total: order.grand_total,
						shipping_method: order.shipping_method,
						order_url: order.order_url,
						fulfilled_on: order.fulfilled_on,
						tracking_number: order.tracking_number,
						tracking_url: order.tracking_url,
						carrier_name: order.carrier_name,
						workflow_stage_id: sql`COALESCE(orders.workflow_stage_id, EXCLUDED.workflow_stage_id)`,
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
							oc.columns(['order_id', 'platform_line_item_id']).doUpdateSet({
								product_name: item.product_name,
								variant_label: variantJson,
								quantity: item.quantity,
								unit_price: item.unit_price,
								image_url: item.image_url,
								workflow_stage_id: sql`COALESCE(order_items.workflow_stage_id, EXCLUDED.workflow_stage_id)`,
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
	const store = await getStoreWithAccessToken(userId);
	if (!store) return null;
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
	if (!store) return { orders: [], lastSyncedAt: null };

	const orders = await db
		.selectFrom('orders')
		.selectAll('orders')
		.leftJoin(
			'order_workflow_stages',
			'order_workflow_stages.id',
			'orders.workflow_stage_id',
		)
		.select([
			sql<string>`(select count(*) from order_items where order_items.order_id = orders.id)`.as(
				'item_count',
			),
			sql<string>`(select count(*) from order_items join order_item_workflow_stages on order_item_workflow_stages.id = order_items.workflow_stage_id where order_items.order_id = orders.id and order_item_workflow_stages.is_complete = true)`.as(
				'items_completed',
			),
			'order_workflow_stages.name as workflow_stage_name',
			'order_workflow_stages.color as workflow_stage_color',
			sql<string | null>`(
				select pb.name
				from production_batch_orders pbo
				inner join production_batches pb on pb.id = pbo.batch_id
				where pbo.order_id = orders.id
				order by pb.created_at desc
				limit 1
			)`.as('batch_name'),
			sql<string | null>`(
				select pb.id
				from production_batch_orders pbo
				inner join production_batches pb on pb.id = pbo.batch_id
				where pbo.order_id = orders.id
				order by pb.created_at desc
				limit 1
			)`.as('batch_id'),
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

export async function getOrdersWithItems(userId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return { orders: [], lastSyncedAt: null };

	const orders = await db
		.selectFrom('orders')
		.selectAll('orders')
		.leftJoin(
			'order_workflow_stages',
			'order_workflow_stages.id',
			'orders.workflow_stage_id',
		)
		.select([
			sql<string>`(select count(*) from order_items where order_items.order_id = orders.id)`.as(
				'item_count',
			),
			sql<string>`(
				select count(*) from order_items oi
				inner join order_item_workflow_stages s on s.id = oi.workflow_stage_id
				where oi.order_id = orders.id and s.is_complete = true
			)`.as('items_completed'),
			'order_workflow_stages.name as workflow_stage_name',
			'order_workflow_stages.color as workflow_stage_color',
			sql<string | null>`(
				select pb.name
				from production_batch_orders pbo
				inner join production_batches pb on pb.id = pbo.batch_id
				where pbo.order_id = orders.id
				order by pb.created_at desc
				limit 1
			)`.as('batch_name'),
			sql<string | null>`(
				select pb.id
				from production_batch_orders pbo
				inner join production_batches pb on pb.id = pbo.batch_id
				where pbo.order_id = orders.id
				order by pb.created_at desc
				limit 1
			)`.as('batch_id'),
		])
		.where('orders.store_id', '=', store.id)
		.where('orders.fulfillment_status', '=', 'pending')
		.orderBy('order_date', 'asc')
		.execute();

	const orderIds = orders.map((o) => o.id);

	const items =
		orderIds.length > 0
			? await db
					.selectFrom('order_items')
					.selectAll('order_items')
					.where('order_id', 'in', orderIds)
					.orderBy('created_at', 'asc')
					.execute()
			: [];

	const itemsByOrder = new Map<string, typeof items>();
	for (const item of items) {
		const group = itemsByOrder.get(item.order_id) ?? [];
		group.push(item);
		itemsByOrder.set(item.order_id, group);
	}

	return {
		orders: orders.map((row) => ({
			...row,
			item_count: Number(row.item_count),
			items_completed: Number(row.items_completed),
			items: itemsByOrder.get(row.id) ?? [],
		})),
		lastSyncedAt: store.last_synced_at,
	};
}

export async function getCompletedOrders(
	userId: string,
	limit: number,
	offset: number,
) {
	const store = await getStoreForUser(userId);
	if (!store) return { orders: [], hasMore: false };

	const orders = await db
		.selectFrom('orders')
		.selectAll('orders')
		.leftJoin(
			'order_workflow_stages',
			'order_workflow_stages.id',
			'orders.workflow_stage_id',
		)
		.select([
			sql<string>`(select count(*) from order_items where order_items.order_id = orders.id)`.as(
				'item_count',
			),
			'order_workflow_stages.name as workflow_stage_name',
			'order_workflow_stages.color as workflow_stage_color',
		])
		.where('orders.store_id', '=', store.id)
		.where('orders.fulfillment_status', '!=', 'pending')
		.orderBy('order_date', 'desc')
		.limit(limit + 1)
		.offset(offset)
		.execute();

	const hasMore = orders.length > limit;
	const trimmed = hasMore ? orders.slice(0, limit) : orders;

	return {
		orders: trimmed.map((row) => ({
			...row,
			item_count: Number(row.item_count),
			items_completed: 0,
			batch_name: null,
			batch_id: null,
		})),
		hasMore,
	};
}

export async function getOrderWithItems(userId: string, orderId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

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

export async function updateOrderStage(
	userId: string,
	orderId: string,
	stageId: string,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

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
	if (!store) return null;

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
			sql<string>`(select count(*) from order_items where order_items.order_id = orders.id)`.as(
				'item_count',
			),
			sql<string>`(
				select count(*) from order_items oi
				inner join order_item_workflow_stages s on s.id = oi.workflow_stage_id
				where oi.order_id = orders.id and s.is_complete = true
			)`.as('items_completed'),
			'order_workflow_stages.name as workflow_stage_name',
			'order_workflow_stages.color as workflow_stage_color',
			sql<string | null>`(
				select pb.name
				from production_batch_orders pbo
				inner join production_batches pb on pb.id = pbo.batch_id
				where pbo.order_id = orders.id
				order by pb.created_at desc
				limit 1
			)`.as('batch_name'),
			sql<string | null>`(
				select pb.id
				from production_batch_orders pbo
				inner join production_batches pb on pb.id = pbo.batch_id
				where pbo.order_id = orders.id
				order by pb.created_at desc
				limit 1
			)`.as('batch_id'),
		])
		.where('orders.store_id', '=', storeId)
		.where('orders.fulfillment_status', '=', 'pending');
}

export async function getWorkflowBoard(userId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return { orders: [], stages: [], activeBatches: [] };

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
			items_completed: Number(row.items_completed),
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
	if (!store) return null;

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

export async function completeAllOrderItems(userId: string, orderId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const order = await db
		.selectFrom('orders')
		.select('id')
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!order) return null;

	const completeStage = await db
		.selectFrom('order_item_workflow_stages')
		.select('id')
		.where('store_id', '=', store.id)
		.where('is_complete', '=', true)
		.executeTakeFirst();

	if (!completeStage) return null;

	await db
		.updateTable('order_items')
		.set({ workflow_stage_id: completeStage.id, updated_at: new Date() })
		.where('order_id', '=', orderId)
		.execute();

	return { orderId, stageId: completeStage.id };
}
