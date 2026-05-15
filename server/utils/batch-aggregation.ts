import { sql, type Transaction } from 'kysely';
import type { Database } from '../db/database-types.js';
import { toJsonb } from './json.js';

type MaterialSnapshot = {
	batch_id: string;
	category: string;
	product_name: string | null;
	material_type: string | null;
	piece: string;
	color: string | null;
	width: string | null;
	quantity: number;
};

export async function populateBatchData(
	trx: Transaction<Database>,
	batchId: string,
	orderIds: string[],
	storeId: string,
) {
	const batchOrders = await trx
		.insertInto('production_batch_orders')
		.values(
			orderIds.map((orderId) => ({ batch_id: batchId, order_id: orderId })),
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
					batch_id: batchId,
					batch_order_id: batchOrderMap.get(item.order_id)!,
					platform_sku: item.platform_sku,
					product_name: item.product_name,
					variant_label: toJsonb(item.variant_label),
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
		.select(sql<string>`sum(order_items.quantity)`.as('total_quantity'))
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
					batch_id: batchId,
					platform_sku: item.platform_sku,
					product_name: item.product_name,
					variant_label: toJsonb(item.variant_label),
					quantity: Number(item.total_quantity),
				})),
			)
			.execute();
	}

	const bomItems = await trx
		.selectFrom('bom_items')
		.leftJoin('materials', 'materials.id', 'bom_items.material_id')
		.leftJoin(
			'bom_material_types',
			'bom_material_types.id',
			'materials.material_type_id',
		)
		.selectAll('bom_items')
		.select([
			'bom_material_types.name as material_type',
			'materials.color',
			'materials.size',
		])
		.where('bom_items.store_id', '=', storeId)
		.execute();

	const materialsRaw: MaterialSnapshot[] = [];

	for (const item of summary) {
		const totalQty = Number(item.total_quantity);

		const matches = bomItems.filter(
			(bom) => bom.platform_sku === item.platform_sku,
		);

		for (const bom of matches) {
			const qty = bom.quantity * totalQty;

			if (bom.measurement === 'area') {
				materialsRaw.push({
					batch_id: batchId,
					category: 'fabric',
					product_name: item.product_name,
					material_type: bom.material_type,
					piece: bom.piece,
					color: bom.color ?? null,
					width: null,
					quantity: qty,
				});
			} else if (bom.measurement === 'linear') {
				const length = bom.length ? Number(bom.length) : 0;
				materialsRaw.push({
					batch_id: batchId,
					category: 'linear',
					product_name: item.product_name,
					material_type: bom.material_type,
					piece: bom.piece,
					color: null,
					width: bom.size ?? null,
					quantity: length * qty,
				});
			} else {
				materialsRaw.push({
					batch_id: batchId,
					category: 'hardware',
					product_name: item.product_name,
					material_type: bom.material_type,
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
			key = `fabric|${entry.material_type}|${entry.product_name}|${entry.piece}|${entry.color}`;
		} else if (entry.category === 'linear') {
			key = `linear|${entry.material_type}|${entry.width}`;
		} else {
			key = `hardware|${entry.material_type}|${entry.piece}`;
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
			.values(materials.map((m) => ({ ...m, quantity: String(m.quantity) })))
			.execute();
	}
}
