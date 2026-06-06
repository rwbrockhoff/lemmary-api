import { sql, type Transaction, type SqlBool } from 'kysely';
import { db } from '../../db/connection.js';
import type { Database } from '../../db/database-types.js';
import {
	getStoreForUser,
	getStoreWithAccessToken,
	type StoreWithAccessToken,
} from '../../utils/store.js';
import { toJsonb } from '../../utils/json.js';
import { computeCustomerTier } from '../../utils/customer-tier.js';
import { applyOrNull } from '../../utils/nullable.js';
import {
	fetchSquarespaceOrders,
	type NormalizedOrder,
} from './platforms/squarespace.js';
import type { GetOrdersQuery } from './contract/types.js';

function getStoreUrl(platformConfig: unknown): string | null {
	return (
		(platformConfig as { store_url?: string | null } | null)?.store_url ?? null
	);
}

function buildOrderUrl(
	storeUrl: string | null,
	platformOrderId: string | null,
): string | null {
	return storeUrl && platformOrderId
		? `${storeUrl}/commerce/orders/${platformOrderId}/authenticated`
		: null;
}

function formatWorkflowOrder<
	T extends {
		platform_order_id: string | null;
		customer_order_count: number | null;
	},
>(row: T, storeUrl: string | null) {
	return {
		...row,
		order_url: buildOrderUrl(storeUrl, row.platform_order_id),
		customer_tier: applyOrNull(row.customer_order_count, computeCustomerTier),
	};
}

function logStageTransition(
	orderId: string,
	fromStageId: string | null,
	toStageId: string,
) {
	db.insertInto('order_stage_history')
		.values({
			order_id: orderId,
			from_stage_id: fromStageId,
			to_stage_id: toStageId,
		})
		.execute()
		.catch((err) => {
			console.error('Failed to log stage transition', err);
		});
}

async function fetchOrdersFromPlatform(
	store: StoreWithAccessToken,
): Promise<NormalizedOrder[]> {
	if (store.platform === 'squarespace') {
		return fetchSquarespaceOrders(store.access_token, store.last_synced_at);
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
		.select(['id', 'workflow_stage_id', 'fulfilled_on'])
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
				transitioned_at: o.fulfilled_on ?? new Date(),
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
							fulfilled_on: order.fulfilled_on,
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

	return { synced, storeId: store.id };
}

export async function getOrders(
	userId: string,
	{ status, limit, offset }: GetOrdersQuery,
) {
	const store = await getStoreForUser(userId);
	if (!store) return { orders: [], hasMore: false, lastSyncedAt: null };

	const isPending = status === 'pending';

	const baseQuery = db
		// Per-customer lifetime order counts, scoped to this store
		.with('customer_counts', (qb) =>
			qb
				.selectFrom('orders')
				.select(['customer_email', sql<number>`count(*)`.as('total')])
				.where('store_id', '=', store.id)
				.where('customer_email', 'is not', null)
				.groupBy('customer_email'),
		)
		// Per-order item totals and completed-item counts
		.with('item_counts', (qb) =>
			qb
				.selectFrom('order_items as oi')
				.innerJoin('orders as o', 'o.id', 'oi.order_id')
				.leftJoin(
					'order_item_workflow_stages as s',
					's.id',
					'oi.workflow_stage_id',
				)
				.select([
					'oi.order_id',
					sql<number>`count(*)`.as('total'),
					sql<number>`count(*) filter (where s.is_complete = true)`.as(
						'completed',
					),
				])
				.where('o.store_id', '=', store.id)
				.groupBy('oi.order_id'),
		)
		// Most recent batch per order via ROW_NUMBER; we keep rn = 1 in the join
		.with('latest_batches', (qb) =>
			qb
				.selectFrom('production_batch_orders as pbo')
				.innerJoin('production_batches as pb', 'pb.id', 'pbo.batch_id')
				.select([
					'pbo.order_id',
					'pb.id as batch_id',
					'pb.name as batch_name',
					sql<number>`row_number() over (partition by pbo.order_id order by pb.created_at desc)`.as(
						'rn',
					),
				])
				.where('pb.store_id', '=', store.id),
		)
		.selectFrom('orders')
		.selectAll('orders')
		.leftJoin(
			'order_workflow_stages',
			'order_workflow_stages.id',
			'orders.workflow_stage_id',
		)
		.leftJoin(
			'customer_counts',
			'customer_counts.customer_email',
			'orders.customer_email',
		)
		.leftJoin('item_counts', 'item_counts.order_id', 'orders.id')
		.leftJoin('latest_batches', (join) =>
			join
				.onRef('latest_batches.order_id', '=', 'orders.id')
				.on(sql<SqlBool>`latest_batches.rn = 1`),
		)
		.select([
			sql<number>`coalesce(item_counts.total, 0)`.as('item_count'),
			sql<number>`coalesce(item_counts.completed, 0)`.as('items_completed'),
			'order_workflow_stages.name as workflow_stage_name',
			'order_workflow_stages.color as workflow_stage_color',
			'latest_batches.batch_name',
			'latest_batches.batch_id',
			'customer_counts.total as customer_order_count',
		])
		.where('orders.store_id', '=', store.id);

	const filteredQuery = isPending
		? baseQuery
				.where('orders.fulfillment_status', '=', 'pending')
				// exclude orders the user has manually placed in a completed stage
				.where(sql<SqlBool>`order_workflow_stages.is_complete is not true`)
				.orderBy('order_date', 'asc')
		: baseQuery
				.where('orders.fulfillment_status', '!=', 'pending')
				.orderBy('order_date', 'desc')
				.limit(limit + 1)
				.offset(offset);

	const rows = await filteredQuery.execute();

	const hasMore = !isPending && rows.length > limit;
	const visibleRows = hasMore ? rows.slice(0, limit) : rows;

	const orderIds = visibleRows.map((row) => row.id);

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

	const storeUrl = getStoreUrl(store.platform_config);

	return {
		orders: visibleRows.map((row) => ({
			...row,
			items: itemsByOrder.get(row.id) ?? [],
			order_url: buildOrderUrl(storeUrl, row.platform_order_id),
			customer_tier: applyOrNull(row.customer_order_count, computeCustomerTier),
		})),
		hasMore,
		lastSyncedAt: store.last_synced_at,
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
		.select([
			'order_workflow_stages.name as workflow_stage_name',
			sql<number | null>`case
				when orders.customer_email is null then null
				else (
					select count(*) from orders o2
					where o2.customer_email = orders.customer_email
					and o2.store_id = orders.store_id
				)
			end`.as('customer_order_count'),
		])
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

	const storeUrl = getStoreUrl(store.platform_config);

	return {
		...order,
		items,
		order_url: buildOrderUrl(storeUrl, order.platform_order_id),
		customer_tier: applyOrNull(order.customer_order_count, computeCustomerTier),
	};
}

export async function updateOrderStage(
	userId: string,
	orderId: string,
	stageId: string,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const current = await db
		.selectFrom('orders')
		.select('workflow_stage_id')
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	const updated = await db
		.updateTable('orders')
		.set({ workflow_stage_id: stageId, updated_at: sql`NOW()` })
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.returningAll()
		.executeTakeFirst();

	if (updated && current && current.workflow_stage_id !== stageId) {
		logStageTransition(orderId, current.workflow_stage_id, stageId);
	}

	return updated;
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
		.set({ order_notes: notes, updated_at: sql`NOW()` })
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.returningAll()
		.executeTakeFirst();
}

function workflowOrdersBase(storeId: string) {
	return db
		.with('customer_counts', (qb) =>
			qb
				.selectFrom('orders')
				.select(['customer_email', sql<number>`count(*)`.as('total')])
				.where('store_id', '=', storeId)
				.where('customer_email', 'is not', null)
				.groupBy('customer_email'),
		)
		.with('item_counts', (qb) =>
			qb
				.selectFrom('order_items as oi')
				.innerJoin('orders as o', 'o.id', 'oi.order_id')
				.leftJoin(
					'order_item_workflow_stages as s',
					's.id',
					'oi.workflow_stage_id',
				)
				.select([
					'oi.order_id',
					sql<number>`count(*)`.as('total'),
					sql<number>`count(*) filter (where s.is_complete = true)`.as(
						'completed',
					),
				])
				.where('o.store_id', '=', storeId)
				.groupBy('oi.order_id'),
		)
		.with('latest_batches', (qb) =>
			qb
				.selectFrom('production_batch_orders as pbo')
				.innerJoin('production_batches as pb', 'pb.id', 'pbo.batch_id')
				.select([
					'pbo.order_id',
					'pb.id as batch_id',
					'pb.name as batch_name',
					sql<number>`row_number() over (partition by pbo.order_id order by pb.created_at desc)`.as(
						'rn',
					),
				])
				.where('pb.store_id', '=', storeId),
		)
		.selectFrom('orders')
		.selectAll('orders')
		.leftJoin(
			'order_workflow_stages',
			'order_workflow_stages.id',
			'orders.workflow_stage_id',
		)
		.leftJoin(
			'customer_counts',
			'customer_counts.customer_email',
			'orders.customer_email',
		)
		.leftJoin('item_counts', 'item_counts.order_id', 'orders.id')
		.leftJoin('latest_batches', (join) =>
			join
				.onRef('latest_batches.order_id', '=', 'orders.id')
				.on(sql<SqlBool>`latest_batches.rn = 1`),
		)
		.select([
			sql<number>`coalesce(item_counts.total, 0)`.as('item_count'),
			sql<number>`coalesce(item_counts.completed, 0)`.as('items_completed'),
			'order_workflow_stages.name as workflow_stage_name',
			'order_workflow_stages.color as workflow_stage_color',
			'latest_batches.batch_name',
			'latest_batches.batch_id',
			'customer_counts.total as customer_order_count',
		])
		.where('orders.store_id', '=', storeId);
}

const COMPLETED_PAGE_SIZE = 10;

export async function getWorkflowBoard(userId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return { stages: [], activeBatches: [] };

	// fire all four independent queries in parallel
	const [openOrders, completedOrders, stages, activeBatches] =
		await Promise.all([
			workflowOrdersBase(store.id)
				.where('order_workflow_stages.is_complete', '!=', true)
				.where('orders.fulfillment_status', '=', 'pending')
				.orderBy('order_date', 'asc')
				.execute(),
			// fetch one extra row to detect hasMore without a count query
			workflowOrdersBase(store.id)
				.where('order_workflow_stages.is_complete', '=', true)
				.orderBy('orders.fulfilled_on', 'desc')
				.orderBy('orders.order_date', 'desc')
				.limit(COMPLETED_PAGE_SIZE + 1)
				.execute(),
			db
				.selectFrom('order_workflow_stages')
				.selectAll()
				.where('store_id', '=', store.id)
				.orderBy('position', 'asc')
				.execute(),
			db
				.selectFrom('production_batches')
				.select(['id', 'name'])
				.where('store_id', '=', store.id)
				.where('status', '=', 'Active')
				.orderBy('created_at', 'desc')
				.execute(),
		]);

	const completedHasMore = completedOrders.length > COMPLETED_PAGE_SIZE;
	const completedSlice = completedHasMore
		? completedOrders.slice(0, COMPLETED_PAGE_SIZE)
		: completedOrders;

	const storeUrl = getStoreUrl(store.platform_config);

	const stagesWithOrders = stages.map((stage) => {
		const sourceOrders = stage.is_complete ? completedSlice : openOrders;
		const ordersInStage = sourceOrders
			.filter((o) => o.workflow_stage_id === stage.id)
			.map((row) => formatWorkflowOrder(row, storeUrl));
		return {
			...stage,
			orders: ordersInStage,
			hasMore: stage.is_complete ? completedHasMore : false,
		};
	});

	return {
		stages: stagesWithOrders,
		activeBatches,
	};
}

export async function getStageOrders(
	userId: string,
	stageId: string,
	limit: number,
	offset: number,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	// confirm the stage belongs to this user's store before pulling orders
	const stage = await db
		.selectFrom('order_workflow_stages')
		.select(['id', 'is_complete'])
		.where('id', '=', stageId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!stage) return null;

	// fetch one extra row to detect hasMore without a count query
	const baseQuery = workflowOrdersBase(store.id)
		.where('orders.workflow_stage_id', '=', stageId)
		.limit(limit + 1)
		.offset(offset);

	const sortedQuery = stage.is_complete
		? baseQuery
				.orderBy('orders.fulfilled_on', 'desc')
				.orderBy('orders.order_date', 'desc')
		: baseQuery.orderBy('order_date', 'asc');

	const rows = await sortedQuery.execute();

	const hasMore = rows.length > limit;
	const sliced = hasMore ? rows.slice(0, limit) : rows;

	const storeUrl = getStoreUrl(store.platform_config);
	const orders = sliced.map((row) => formatWorkflowOrder(row, storeUrl));

	return { orders, hasMore };
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
		.set({ workflow_stage_id: stageId, updated_at: sql`NOW()` })
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
		.set({ workflow_stage_id: completeStage.id, updated_at: sql`NOW()` })
		.where('order_id', '=', orderId)
		.execute();

	return { orderId, stageId: completeStage.id };
}
