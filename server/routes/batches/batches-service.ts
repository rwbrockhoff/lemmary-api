import { sql } from 'kysely';
import { db } from '../../db/connection.js';

async function getStoreForUser(userId: string) {
	const store = await db
		.selectFrom('stores')
		.selectAll()
		.where('user_id', '=', userId)
		.executeTakeFirst();

	if (!store) throw new Error('No store found for user');
	return store;
}

function extractBaseColor(variantLabel: string | null): string {
	if (!variantLabel) return '';
	return variantLabel.split('(')[0].trim();
}

export async function getBatches(userId: string) {
	const store = await getStoreForUser(userId);

	const batches = await db
		.selectFrom('production_batches')
		.selectAll()
		.select([
			sql<string>`(select count(*) from production_batch_orders where batch_id = production_batches.id)`.as(
				'order_count',
			),
			sql<string>`(select coalesce(sum(quantity), 0) from production_batch_order_items where batch_id = production_batches.id)`.as(
				'item_count',
			),
			sql<string>`(select coalesce(sum(completed_qty), 0) from production_batch_order_items where batch_id = production_batches.id)`.as(
				'items_completed',
			),
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
		.select([
			'production_batch_orders.id',
			'production_batch_orders.order_id',
			'production_batch_orders.completed',
			'orders.order_number',
			'orders.customer_name',
			'orders.order_date',
			'orders.grand_total',
		])
		.where('production_batch_orders.batch_id', '=', batchId)
		.orderBy('orders.order_date', 'desc')
		.execute();

	const items = await db
		.selectFrom('production_batch_items')
		.selectAll()
		.where('batch_id', '=', batchId)
		.orderBy('product_name', 'asc')
		.orderBy('variant_label', 'asc')
		.execute();

	const orderItems = await db
		.selectFrom('production_batch_order_items')
		.selectAll()
		.where('batch_id', '=', batchId)
		.orderBy('product_name', 'asc')
		.orderBy('variant_label', 'asc')
		.execute();

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

	const orders = await db
		.selectFrom('orders')
		.select('id')
		.where('id', 'in', orderIds)
		.where('store_id', '=', store.id)
		.execute();

	if (orders.length !== orderIds.length) {
		throw new Error('One or more orders not found');
	}

	return db.transaction().execute(async (trx) => {
		const batch = await trx
			.insertInto('production_batches')
			.values({ store_id: store.id, name })
			.returningAll()
			.executeTakeFirstOrThrow();

		const batchOrders = await trx
			.insertInto('production_batch_orders')
			.values(
				orderIds.map((orderId) => ({
					batch_id: batch.id,
					order_id: orderId,
				})),
			)
			.returning(['id', 'order_id'])
			.execute();

		const orderItems = await trx
			.selectFrom('order_items')
			.selectAll()
			.where(
				'order_id',
				'in',
				batchOrders.map((bo) => bo.order_id),
			)
			.execute();

		if (orderItems.length > 0) {
			const batchOrderMap = new Map(
				batchOrders.map((bo) => [bo.order_id, bo.id]),
			);

			await trx
				.insertInto('production_batch_order_items')
				.values(
					orderItems.map((item) => ({
						batch_id: batch.id,
						batch_order_id: batchOrderMap.get(item.order_id)!,
						platform_sku: item.platform_sku,
						product_name: item.product_name,
						variant_label: item.variant_label,
						quantity: item.quantity,
					})),
				)
				.execute();
		}

		const summary = await trx
			.selectFrom('order_items')
			.innerJoin('orders', 'orders.id', 'order_items.order_id')
			.select([
				'order_items.platform_sku',
				'order_items.product_name',
				'order_items.variant_label',
			])
			.select(
				sql<string>`sum(order_items.quantity)`.as('total_quantity'),
			)
			.where('orders.id', 'in', orderIds)
			.groupBy([
				'order_items.platform_sku',
				'order_items.product_name',
				'order_items.variant_label',
			])
			.execute();

		if (summary.length > 0) {
			await trx
				.insertInto('production_batch_items')
				.values(
					summary.map((item) => ({
						batch_id: batch.id,
						platform_sku: item.platform_sku,
						product_name: item.product_name,
						variant_label: item.variant_label,
						quantity: Number(item.total_quantity),
					})),
				)
				.execute();
		}

		const bomItems = await trx
			.selectFrom('bom_items')
			.innerJoin(
				'bom_material_types',
				'bom_material_types.id',
				'bom_items.material_type_id',
			)
			.selectAll('bom_items')
			.select([
				'bom_material_types.name as material_type',
				'bom_material_types.measurement',
			])
			.where('bom_items.store_id', '=', store.id)
			.execute();

		type MaterialSnapshot = {
			batch_id: string;
			category: string;
			material_type: string | null;
			piece: string;
			color: string | null;
			width: string | null;
			quantity: number;
		};

		const materialsRaw: MaterialSnapshot[] = [];

		for (const item of summary) {
			const baseColor = extractBaseColor(item.variant_label);
			const totalQty = Number(item.total_quantity);

			const matches = bomItems.filter(
				(bom) =>
					bom.platform_sku === item.platform_sku &&
					(baseColor === ''
						? true
						: bom.variant
								?.toLowerCase()
								.includes(baseColor.toLowerCase())),
			);

			for (const bom of matches) {
				const qty = bom.quantity * totalQty;

				if (bom.measurement === 'area') {
					materialsRaw.push({
						batch_id: batch.id,
						category: 'fabric',
						material_type: null,
						piece: bom.piece,
						color: bom.color,
						width: null,
						quantity: qty,
					});
				} else if (bom.measurement === 'linear') {
					const length = bom.length ? Number(bom.length) : 0;
					materialsRaw.push({
						batch_id: batch.id,
						category: 'linear',
						material_type: bom.material_type,
						piece: bom.piece,
						color: null,
						width: bom.width,
						quantity: length * qty,
					});
				} else {
					materialsRaw.push({
						batch_id: batch.id,
						category: 'hardware',
						material_type: null,
						piece: bom.piece,
						color: null,
						width: null,
						quantity: qty,
					});
				}
			}
		}

		const materialMap = new Map<string, MaterialSnapshot>();
		for (const entry of materialsRaw) {
			let key: string;
			if (entry.category === 'fabric') {
				key = `fabric|${entry.piece}|${entry.color}`;
			} else if (entry.category === 'linear') {
				key = `linear|${entry.material_type}|${entry.width}`;
			} else {
				key = `hardware|${entry.piece}`;
			}

			const existing = materialMap.get(key);
			if (existing) {
				existing.quantity += entry.quantity;
			} else {
				materialMap.set(key, { ...entry });
			}
		}

		const materials = [...materialMap.values()];
		if (materials.length > 0) {
			await trx
				.insertInto('production_batch_materials')
				.values(
					materials.map((m) => ({
						...m,
						quantity: String(m.quantity),
					})),
				)
				.execute();
		}

		return batch;
	});
}

export async function updateBatchStatus(
	userId: string,
	batchId: string,
	status: string,
) {
	const store = await getStoreForUser(userId);

	return db
		.updateTable('production_batches')
		.set({
			status,
			completed_at: status === 'completed' ? new Date() : null,
			updated_at: new Date(),
		})
		.where('id', '=', batchId)
		.where('store_id', '=', store.id)
		.returningAll()
		.executeTakeFirst();
}

async function verifyBatchOwnership(userId: string, batchId: string) {
	const store = await getStoreForUser(userId);

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
