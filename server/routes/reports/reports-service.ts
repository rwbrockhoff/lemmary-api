import { sql } from 'kysely';
import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';

export async function getProductionSummary(userId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return [];

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
	if (!store) {
		return { fabric: [], linear: [], hardware: [], mismatches: [] };
	}

	const productionSummary = await getProductionSummary(userId);

	const bomItems = await db
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
		.where('bom_items.store_id', '=', store.id)
		.execute();

	const variantRows = await db
		.selectFrom('product_variants')
		.innerJoin('products', 'products.id', 'product_variants.product_id')
		.select([
			'product_variants.platform_sku',
			'product_variants.id as variant_id',
			'products.id as product_id',
		])
		.where('products.store_id', '=', store.id)
		.where('product_variants.platform_sku', 'is not', null)
		.execute();

	const skuLookup = new Map<string, { productId: string; variantId: string }>();
	for (const row of variantRows) {
		if (row.platform_sku) {
			skuLookup.set(row.platform_sku, {
				productId: row.product_id,
				variantId: row.variant_id,
			});
		}
	}

	type FabricEntry = {
		material_type: string;
		product_name: string;
		piece: string;
		color: string;
		total_quantity: number;
	};

	type LinearEntry = {
		material_type: string | null;
		width: number | null;
		total_inches: number;
	};

	type HardwareEntry = {
		material_type: string;
		piece: string;
		total_count: number;
	};

	type Mismatch = {
		platform_sku: string | null;
		product_name: string;
		variant_label: { name: string; value: string }[] | null;
		product_id: string | null;
		variant_id: string | null;
	};

	const fabricRaw: FabricEntry[] = [];
	const linearRaw: LinearEntry[] = [];
	const hardwareRaw: HardwareEntry[] = [];
	const mismatches: Mismatch[] = [];

	for (const item of productionSummary) {
		const matches = bomItems.filter(
			(bom) => bom.platform_sku === item.platform_sku,
		);

		if (matches.length === 0) {
			const skuMatch = item.platform_sku
				? skuLookup.get(item.platform_sku)
				: undefined;
			mismatches.push({
				platform_sku: item.platform_sku,
				product_name: item.product_name,
				variant_label: item.variant_label,
				product_id: skuMatch?.productId ?? null,
				variant_id: skuMatch?.variantId ?? null,
			});
			continue;
		}

		for (const bom of matches) {
			const totalQty = bom.quantity * item.total_quantity;

			if (bom.measurement === 'area') {
				fabricRaw.push({
					material_type: bom.material_type ?? 'Unknown',
					product_name: item.product_name,
					piece: bom.piece,
					color: bom.color ?? '',
					total_quantity: totalQty,
				});
			} else if (bom.measurement === 'linear') {
				const length = bom.length ? Number(bom.length) : 0;
				const parsedWidth = bom.size ? Number(bom.size) : null;
				linearRaw.push({
					material_type: bom.material_type,
					width:
						parsedWidth !== null && Number.isFinite(parsedWidth)
							? parsedWidth
							: null,
					total_inches: length * totalQty,
				});
			} else {
				hardwareRaw.push({
					material_type: bom.material_type ?? 'Unknown',
					piece: bom.piece,
					total_count: totalQty,
				});
			}
		}
	}

	const fabricMap = new Map<string, FabricEntry>();
	for (const entry of fabricRaw) {
		const key = `${entry.material_type}|${entry.product_name}|${entry.piece}|${entry.color}`;
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
		const key = `${entry.material_type}|${entry.piece}`;
		const existing = hardwareMap.get(key);
		if (existing) {
			existing.total_count += entry.total_count;
		} else {
			hardwareMap.set(key, { ...entry });
		}
	}

	const fabric = [...fabricMap.values()].sort((a, b) =>
		a.material_type.localeCompare(b.material_type) ||
		a.piece.localeCompare(b.piece),
	);

	const linear = [...linearMap.values()]
		.map((entry) => ({
			...entry,
			total_feet: Math.round((entry.total_inches / 12) * 100) / 100,
			feet_to_order: Math.ceil(entry.total_inches / 12),
		}))
		.sort((a, b) =>
			(a.material_type ?? '').localeCompare(b.material_type ?? '') ||
			(a.width ?? 0) - (b.width ?? 0),
		);

	const hardware = [...hardwareMap.values()].sort((a, b) =>
		a.material_type.localeCompare(b.material_type) ||
		a.piece.localeCompare(b.piece),
	);

	return { fabric, linear, hardware, mismatches };
}
