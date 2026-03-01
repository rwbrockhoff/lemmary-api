import { sql } from 'kysely';
import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';
import { extractBaseColor } from '../../utils/variants.js';

export async function getProductionSummary(userId: string) {
	const store = await getStoreForUser(userId);

	const summary = await db
		.selectFrom('order_items')
		.innerJoin('orders', 'orders.id', 'order_items.order_id')
		.select([
			'order_items.platform_sku',
			'order_items.product_name',
			'order_items.variant_label',
		])
		.select(sql<string>`sum(order_items.quantity)`.as('total_quantity'))
		.where('orders.store_id', '=', store.id)
		.where('orders.fulfillment_status', '=', 'pending')
		.groupBy([
			'order_items.platform_sku',
			'order_items.product_name',
			'order_items.variant_label',
		])
		.orderBy('order_items.product_name', 'asc')
		.orderBy('order_items.variant_label', 'asc')
		.execute();

	return summary.map((row) => ({
		...row,
		total_quantity: Number(row.total_quantity),
	}));
}

export async function getMaterialsReport(userId: string) {
	const store = await getStoreForUser(userId);

	const productionSummary = await getProductionSummary(userId);

	const bomItems = await db
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

	type FabricEntry = {
		product_name: string;
		piece: string;
		color: string;
		total_quantity: number;
	};

	type LinearEntry = {
		material_type: string;
		width: number | null;
		total_inches: number;
	};

	type HardwareEntry = {
		piece: string;
		total_count: number;
	};

	type Mismatch = {
		platform_sku: string | null;
		product_name: string;
		variant_label: { name: string; value: string }[] | null;
	};

	const fabricRaw: FabricEntry[] = [];
	const linearRaw: LinearEntry[] = [];
	const hardwareRaw: HardwareEntry[] = [];
	const mismatches: Mismatch[] = [];

	for (const item of productionSummary) {
		const baseColor = extractBaseColor(item.variant_label);

		const matches = bomItems.filter(
			(bom) =>
				bom.platform_sku === item.platform_sku &&
				(baseColor === ''
					? true
					: bom.variant?.toLowerCase().includes(baseColor.toLowerCase())),
		);

		if (matches.length === 0) {
			mismatches.push({
				platform_sku: item.platform_sku,
				product_name: item.product_name,
				variant_label: item.variant_label,
			});
			continue;
		}

		for (const bom of matches) {
			const totalQty = bom.quantity * item.total_quantity;

			if (bom.measurement === 'area') {
				fabricRaw.push({
					product_name: item.product_name,
					piece: bom.piece,
					color: bom.color ?? '',
					total_quantity: totalQty,
				});
			} else if (bom.measurement === 'linear') {
				const length = bom.length ? Number(bom.length) : 0;
				linearRaw.push({
					material_type: bom.material_type,
					width: bom.width ? Number(bom.width) : null,
					total_inches: length * totalQty,
				});
			} else {
				hardwareRaw.push({
					piece: bom.piece,
					total_count: totalQty,
				});
			}
		}
	}

	const fabricMap = new Map<string, FabricEntry>();
	for (const entry of fabricRaw) {
		const key = `${entry.product_name}|${entry.piece}|${entry.color}`;
		const existing = fabricMap.get(key);
		if (existing) {
			existing.total_quantity += entry.total_quantity;
		} else {
			fabricMap.set(key, { ...entry });
		}
	}

	const linearMap = new Map<string, LinearEntry>();
	for (const entry of linearRaw) {
		const key = `${entry.material_type}|${entry.width}`;
		const existing = linearMap.get(key);
		if (existing) {
			existing.total_inches += entry.total_inches;
		} else {
			linearMap.set(key, { ...entry });
		}
	}

	const hardwareMap = new Map<string, HardwareEntry>();
	for (const entry of hardwareRaw) {
		const existing = hardwareMap.get(entry.piece);
		if (existing) {
			existing.total_count += entry.total_count;
		} else {
			hardwareMap.set(entry.piece, { ...entry });
		}
	}

	const fabric = [...fabricMap.values()].sort((a, b) =>
		a.product_name.localeCompare(b.product_name) ||
		a.piece.localeCompare(b.piece),
	);

	const linear = [...linearMap.values()]
		.map((entry) => ({
			...entry,
			total_feet: Math.round((entry.total_inches / 12) * 100) / 100,
			feet_to_order: Math.ceil(entry.total_inches / 12),
		}))
		.sort((a, b) =>
			a.material_type.localeCompare(b.material_type) ||
			(a.width ?? 0) - (b.width ?? 0),
		);

	const hardware = [...hardwareMap.values()].sort((a, b) =>
		a.piece.localeCompare(b.piece),
	);

	return { fabric, linear, hardware, mismatches };
}
