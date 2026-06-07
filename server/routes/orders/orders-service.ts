import { sql, type SqlBool } from 'kysely';
import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';
import { computeCustomerTier } from '../../utils/customer-tier.js';
import { applyOrNull } from '../../utils/nullable.js';
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
					sql<number>`coalesce(sum(oi.quantity), 0)`.as('total'),
					sql<number>`coalesce(sum(oi.quantity) filter (where s.is_complete = true), 0)`.as(
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

type DeleteOrderResult =
	| { ok: true }
	| { ok: false; error: 'not_found' | 'platform' };

export async function deleteOrder(
	userId: string,
	orderId: string,
): Promise<DeleteOrderResult> {
	const store = await getStoreForUser(userId);
	if (!store) return { ok: false, error: 'not_found' };

	const order = await db
		.selectFrom('orders')
		.select('order_type')
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!order) return { ok: false, error: 'not_found' };
	if (order.order_type === 'platform') return { ok: false, error: 'platform' };

	await db
		.deleteFrom('orders')
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.execute();

	return { ok: true };
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
					sql<number>`coalesce(sum(oi.quantity), 0)`.as('total'),
					sql<number>`coalesce(sum(oi.quantity) filter (where s.is_complete = true), 0)`.as(
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
