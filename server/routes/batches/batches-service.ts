import { sql, type Transaction } from 'kysely';
import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';
import { populateBatchData } from '../../utils/batch-aggregation.js';
import { AppError } from '../../utils/app-error.js';
import type { Database } from '../../db/database-types.js';

export async function getBatches(userId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return [];

	const batches = await db
		.selectFrom('production_batches')
		.selectAll()
		.select([
			sql<string>`(select count(*) from production_batch_orders where batch_id = production_batches.id)`.as(
				'order_count',
			),
			sql<string>`(
				select coalesce(sum(oi.quantity), 0)
				from production_batch_orders pbo
				inner join order_items oi on oi.order_id = pbo.order_id
				where pbo.batch_id = production_batches.id
			)`.as('item_count'),
			sql<string>`(
				select coalesce(sum(oi.quantity), 0)
				from production_batch_orders pbo
				inner join order_items oi on oi.order_id = pbo.order_id
				inner join order_item_workflow_stages oiws on oiws.id = oi.workflow_stage_id
				where pbo.batch_id = production_batches.id
				and oiws.is_complete = true
			)`.as('items_completed'),
		])
		.where('store_id', '=', store.id)
		.orderBy('created_at', 'desc')
		.execute();

	return batches.map((row) => ({
		...row,
		order_count: Number(row.order_count),
		item_count: Number(row.item_count),
		items_completed: Number(row.items_completed),
	}));
}

export async function getBatch(userId: string, batchId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const batch = await db
		.selectFrom('production_batches')
		.selectAll()
		.where('id', '=', batchId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!batch) return null;

	const orders = await db
		.selectFrom('production_batch_orders')
		.innerJoin('orders', 'orders.id', 'production_batch_orders.order_id')
		.leftJoin(
			'order_workflow_stages',
			'order_workflow_stages.id',
			'orders.workflow_stage_id',
		)
		.select([
			'production_batch_orders.id',
			'production_batch_orders.order_id',
			'production_batch_orders.completed',
			'orders.order_number',
			'orders.customer_name',
			'orders.order_date',
			'orders.due_date',
			'orders.grand_total',
			'orders.workflow_stage_id',
			'order_workflow_stages.name as workflow_stage_name',
			'order_workflow_stages.color as workflow_stage_color',
		])
		.where('production_batch_orders.batch_id', '=', batchId)
		.orderBy('orders.order_date', 'asc')
		.execute();

	const items = await db
		.selectFrom('production_batch_items')
		.selectAll()
		.where('batch_id', '=', batchId)
		.orderBy('product_name', 'asc')
		.orderBy('variant_label', 'asc')
		.execute();

	const orderIds = orders.map((o) => o.order_id);

	const orderItems =
		orderIds.length > 0
			? await db
					.selectFrom('order_items')
					.innerJoin(
						'production_batch_orders',
						'production_batch_orders.order_id',
						'order_items.order_id',
					)
					.leftJoin(
						'order_item_workflow_stages',
						'order_item_workflow_stages.id',
						'order_items.workflow_stage_id',
					)
					.select([
						'order_items.id',
						'order_items.order_id',
						'production_batch_orders.id as batch_order_id',
						'order_items.platform_sku',
						'order_items.product_name',
						'order_items.variant_label',
						'order_items.quantity',
						'order_items.workflow_stage_id',
						'order_item_workflow_stages.name as workflow_stage_name',
						'order_item_workflow_stages.is_complete',
					])
					.where('production_batch_orders.batch_id', '=', batchId)
					.where('order_items.order_id', 'in', orderIds)
					.orderBy('order_items.product_name', 'asc')
					.orderBy('order_items.variant_label', 'asc')
					.execute()
			: [];

	const materials = await db
		.selectFrom('production_batch_materials')
		.selectAll()
		.where('batch_id', '=', batchId)
		.orderBy('category', 'asc')
		.orderBy('piece', 'asc')
		.execute();

	return { ...batch, orders, items, orderItems, materials };
}

export async function createBatch(
	userId: string,
	name: string,
	orderIds: string[],
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const orders = await db
		.selectFrom('orders')
		.select('id')
		.where('id', 'in', orderIds)
		.where('store_id', '=', store.id)
		.where('fulfillment_status', '=', 'pending')
		.execute();

	if (orders.length !== orderIds.length) {
		throw AppError.badRequest('One or more orders not found');
	}

	return db.transaction().execute(async (trx) => {
		const batch = await trx
			.insertInto('production_batches')
			.values({ store_id: store.id, name })
			.returningAll()
			.executeTakeFirstOrThrow();

		await populateBatchData(trx, batch.id, orderIds, store.id);

		return batch;
	});
}

export async function updateBatch(
	userId: string,
	batchId: string,
	updates: { status?: string; name?: string; orderIds?: string[] },
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	return db.transaction().execute(async (trx) => {
		const set: Record<string, unknown> = { updated_at: new Date() };

		if (updates.status) {
			set.status = updates.status;
			set.completed_at = updates.status === 'Completed' ? new Date() : null;
		}

		if (updates.name) {
			set.name = updates.name.trim();
		}

		const batch = await trx
			.updateTable('production_batches')
			.set(set)
			.where('id', '=', batchId)
			.where('store_id', '=', store.id)
			.returningAll()
			.executeTakeFirst();

		if (!batch) return null;

		if (updates.orderIds) {
			const orders = await trx
				.selectFrom('orders')
				.select('id')
				.where('id', 'in', updates.orderIds)
				.where('store_id', '=', store.id)
				.where('fulfillment_status', '=', 'pending')
				.execute();

			if (orders.length !== updates.orderIds.length) {
				throw AppError.badRequest('One or more orders not found');
			}

			await clearBatchData(trx, batchId);
			await populateBatchData(trx, batchId, updates.orderIds, store.id);
		}

		return batch;
	});
}

export async function deleteBatch(userId: string, batchId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	return db.transaction().execute(async (trx) => {
		await clearBatchData(trx, batchId);

		const deleted = await trx
			.deleteFrom('production_batches')
			.where('id', '=', batchId)
			.where('store_id', '=', store.id)
			.returningAll()
			.executeTakeFirst();

		return deleted;
	});
}

async function clearBatchData(trx: Transaction<Database>, batchId: string) {
	await trx
		.deleteFrom('production_batch_materials')
		.where('batch_id', '=', batchId)
		.execute();

	await trx
		.deleteFrom('production_batch_order_items')
		.where('batch_id', '=', batchId)
		.execute();

	await trx
		.deleteFrom('production_batch_items')
		.where('batch_id', '=', batchId)
		.execute();

	await trx
		.deleteFrom('production_batch_orders')
		.where('batch_id', '=', batchId)
		.execute();
}

async function verifyBatchOwnership(userId: string, batchId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return undefined;

	return db
		.selectFrom('production_batches')
		.select('id')
		.where('id', '=', batchId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();
}

export async function toggleOrderComplete(
	userId: string,
	batchId: string,
	batchOrderId: string,
	completed: boolean,
) {
	const batch = await verifyBatchOwnership(userId, batchId);
	if (!batch) return null;

	const order = await db
		.updateTable('production_batch_orders')
		.set({ completed })
		.where('id', '=', batchOrderId)
		.where('batch_id', '=', batchId)
		.returningAll()
		.executeTakeFirst();

	if (!order) return null;

	if (completed) {
		await db
			.updateTable('production_batch_order_items')
			.set({
				completed: true,
				completed_qty: sql`quantity`,
			})
			.where('batch_order_id', '=', batchOrderId)
			.execute();
	} else {
		await db
			.updateTable('production_batch_order_items')
			.set({ completed: false, completed_qty: 0 })
			.where('batch_order_id', '=', batchOrderId)
			.execute();
	}

	return order;
}

export async function toggleItemComplete(
	userId: string,
	batchId: string,
	batchItemId: string,
	completed: boolean,
) {
	const batch = await verifyBatchOwnership(userId, batchId);
	if (!batch) return null;

	return db
		.updateTable('production_batch_items')
		.set({ completed })
		.where('id', '=', batchItemId)
		.where('batch_id', '=', batchId)
		.returningAll()
		.executeTakeFirst();
}

export async function toggleMaterialComplete(
	userId: string,
	batchId: string,
	batchMaterialId: string,
	completed: boolean,
) {
	const batch = await verifyBatchOwnership(userId, batchId);
	if (!batch) return null;

	return db
		.updateTable('production_batch_materials')
		.set({ completed })
		.where('id', '=', batchMaterialId)
		.where('batch_id', '=', batchId)
		.returningAll()
		.executeTakeFirst();
}

export async function updateOrderItemCompletedQty(
	userId: string,
	batchId: string,
	orderItemId: string,
	completedQty: number,
) {
	const batch = await verifyBatchOwnership(userId, batchId);
	if (!batch) return null;

	const updated = await db
		.updateTable('production_batch_order_items')
		.set({
			completed_qty: completedQty,
			completed: sql<boolean>`${completedQty} >= quantity`,
		})
		.where('id', '=', orderItemId)
		.where('batch_id', '=', batchId)
		.returningAll()
		.executeTakeFirstOrThrow();

	const siblings = await db
		.selectFrom('production_batch_order_items')
		.select(['completed'])
		.where('batch_order_id', '=', updated.batch_order_id)
		.execute();

	const allComplete = siblings.every((s) => s.completed);

	await db
		.updateTable('production_batch_orders')
		.set({ completed: allComplete })
		.where('id', '=', updated.batch_order_id)
		.execute();

	return updated;
}

export async function updateMaterialCompletedQty(
	userId: string,
	batchId: string,
	materialId: string,
	completedQty: number,
) {
	const batch = await verifyBatchOwnership(userId, batchId);
	if (!batch) return null;

	return db
		.updateTable('production_batch_materials')
		.set({
			completed_qty: completedQty,
			completed: sql<boolean>`${completedQty} >= quantity`,
		})
		.where('id', '=', materialId)
		.where('batch_id', '=', batchId)
		.returningAll()
		.executeTakeFirst();
}
