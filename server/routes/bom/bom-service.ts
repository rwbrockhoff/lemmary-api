import { sql } from 'kysely';
import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';

export async function getMaterialTypes(userId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return [];

	return db
		.selectFrom('bom_material_types')
		.selectAll()
		.where('store_id', '=', store.id)
		.orderBy('position', 'asc')
		.execute();
}

export async function getBomForVariant(userId: string, variantId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return [];

	const variant = await db
		.selectFrom('product_variants')
		.innerJoin('products', 'products.id', 'product_variants.product_id')
		.select(['product_variants.platform_sku', 'product_variants.name'])
		.where('product_variants.id', '=', variantId)
		.where('products.store_id', '=', store.id)
		.executeTakeFirst();

	if (!variant?.platform_sku) return [];

	const bomItems = await db
		.selectFrom('bom_items')
		.leftJoin('materials', 'materials.id', 'bom_items.material_id')
		.leftJoin(
			'bom_material_types',
			'bom_material_types.id',
			'materials.material_type_id',
		)
		.select([
			'bom_items.id',
			'bom_items.store_id',
			'bom_items.material_id',
			'bom_items.measurement',
			'bom_items.platform_sku',
			'bom_items.product_name',
			'bom_items.variant',
			'bom_items.piece',
			'bom_items.length',
			'bom_items.quantity',
			'bom_items.position',
			'bom_items.created_at',
			'bom_items.updated_at',
			'materials.material_type_id',
			'bom_material_types.name as material_type_name',
			'materials.color',
			'materials.size',
			'materials.purchase_url',
		])
		.where('bom_items.store_id', '=', store.id)
		.where('bom_items.platform_sku', '=', variant.platform_sku)
		.orderBy('bom_items.position', 'asc')
		.execute();

	return bomItems;
}

type CreateBomItemInput = {
	measurement: 'area' | 'linear' | 'count';
	platform_sku: string;
	product_name: string;
	variant: string | null;
	piece: string;
	length: string | null;
	quantity: number;
	material_id: string | null;
};

export async function createBomItem(userId: string, input: CreateBomItemInput) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const maxPosition = await db
		.selectFrom('bom_items')
		.select(sql<number>`coalesce(max(position), 0)`.as('max_pos'))
		.where('store_id', '=', store.id)
		.where('platform_sku', '=', input.platform_sku)
		.where('measurement', '=', input.measurement)
		.executeTakeFirst();

	const position = (maxPosition?.max_pos ?? 0) + 1000;

	const result = await db
		.insertInto('bom_items')
		.values({
			store_id: store.id,
			...input,
			position,
		})
		.returningAll()
		.executeTakeFirstOrThrow();

	return result;
}

type UpdateBomItemInput = {
	piece: string;
	length: string | null;
	quantity: number;
	measurement: string;
	material_type_id: string | null;
	material_type_name: string | null;
	color: string | null;
	size: string | null;
	purchase_url: string | null;
};

const MEASUREMENT_DEFAULTS: Record<
	string,
	{
		unit: 'pieces' | 'inches' | 'sq_ft' | 'yards';
		tracks_color: boolean;
		tracks_size: boolean;
	}
> = {
	area: { unit: 'sq_ft', tracks_color: true, tracks_size: false },
	linear: { unit: 'inches', tracks_color: false, tracks_size: true },
	count: { unit: 'pieces', tracks_color: false, tracks_size: true },
};

export async function updateBomItem(
	userId: string,
	bomItemId: string,
	input: UpdateBomItemInput,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	let materialId: string | null = null;

	const hasType = input.material_type_id || input.material_type_name;

	if (hasType) {
		let typeId = input.material_type_id;

		if (!typeId && input.material_type_name) {
			const trimmedName = input.material_type_name.trim();

			const findByName = () =>
				db
					.selectFrom('bom_material_types')
					.select('id')
					.where('store_id', '=', store.id)
					.where(sql<boolean>`lower(name) = lower(${trimmedName})`)
					.where(
						'measurement',
						'=',
						input.measurement as 'area' | 'linear' | 'count',
					)
					.executeTakeFirst();

			const existing = await findByName();

			if (existing) {
				typeId = existing.id;
			} else {
				const maxPos = await db
					.selectFrom('bom_material_types')
					.select(sql<number>`coalesce(max(position), 0)`.as('max_pos'))
					.where('store_id', '=', store.id)
					.executeTakeFirst();

				const defaults =
					MEASUREMENT_DEFAULTS[input.measurement] ?? MEASUREMENT_DEFAULTS.count;

				const inserted = await db
					.insertInto('bom_material_types')
					.values({
						store_id: store.id,
						name: trimmedName,
						measurement: input.measurement as 'area' | 'linear' | 'count',
						...defaults,
						position: (maxPos?.max_pos ?? 0) + 1,
					})
					.onConflict((oc) => oc.doNothing())
					.returning('id')
					.executeTakeFirst();

				if (inserted) {
					typeId = inserted.id;
				} else {
					const raced = await findByName();
					typeId = raced?.id ?? null;
				}
			}
		}

		if (typeId) {
			const material = await getOrCreateMaterial(
				userId,
				typeId,
				input.color,
				input.size,
				input.purchase_url,
			);
			materialId = material?.id ?? null;
		}
	}

	const result = await db
		.updateTable('bom_items')
		.set({
			piece: input.piece,
			length: input.length,
			quantity: input.quantity,
			material_id: materialId,
			updated_at: sql`NOW()`,
		})
		.where('id', '=', bomItemId)
		.where('store_id', '=', store.id)
		.returningAll()
		.executeTakeFirst();

	return result;
}

export async function deleteBomItem(userId: string, bomItemId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return false;

	const result = await db
		.deleteFrom('bom_items')
		.where('id', '=', bomItemId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	return result.numDeletedRows > 0n;
}

export async function copyBomFromVariant(
	userId: string,
	targetVariantId: string,
	sourceVariantId: string,
) {
	const store = await getStoreForUser(userId);
	if (!store) return [];

	const [sourceVariant, targetVariant] = await Promise.all([
		db
			.selectFrom('product_variants')
			.innerJoin('products', 'products.id', 'product_variants.product_id')
			.select([
				'product_variants.platform_sku',
				'product_variants.name',
				'products.name as product_name',
			])
			.where('product_variants.id', '=', sourceVariantId)
			.where('products.store_id', '=', store.id)
			.executeTakeFirst(),
		db
			.selectFrom('product_variants')
			.innerJoin('products', 'products.id', 'product_variants.product_id')
			.select([
				'product_variants.platform_sku',
				'product_variants.name',
				'products.name as product_name',
			])
			.where('product_variants.id', '=', targetVariantId)
			.where('products.store_id', '=', store.id)
			.executeTakeFirst(),
	]);

	if (!sourceVariant?.platform_sku || !targetVariant?.platform_sku) {
		return [];
	}

	const sourceItems = await db
		.selectFrom('bom_items')
		.select(['material_id', 'measurement', 'piece', 'length', 'quantity'])
		.where('store_id', '=', store.id)
		.where('platform_sku', '=', sourceVariant.platform_sku)
		.orderBy('position', 'asc')
		.execute();

	if (sourceItems.length === 0) return [];

	const copies = sourceItems.map((item, index) => ({
		store_id: store.id,
		material_id: item.material_id,
		measurement: item.measurement,
		platform_sku: targetVariant.platform_sku!,
		product_name: targetVariant.product_name,
		variant: targetVariant.name,
		piece: item.piece,
		length: item.length,
		quantity: item.quantity,
		position: (index + 1) * 1000,
	}));

	await db.insertInto('bom_items').values(copies).execute();

	return getBomForVariant(userId, targetVariantId);
}

export async function searchMaterialTypes(
	userId: string,
	query: string,
	measurement?: string,
) {
	const store = await getStoreForUser(userId);
	if (!store) return [];

	let q = db
		.selectFrom('bom_material_types')
		.selectAll()
		.where('store_id', '=', store.id)
		.where('name', 'ilike', `%${query}%`)
		.orderBy('name', 'asc')
		.limit(5);

	if (measurement) {
		q = q.where('measurement', '=', measurement as 'count' | 'linear' | 'area');
	}

	return q.execute();
}

export async function searchMaterialCatalog(
	userId: string,
	query: string,
	measurement?: string,
) {
	const store = await getStoreForUser(userId);
	if (!store) return [];

	let q = db
		.selectFrom('materials')
		.innerJoin(
			'bom_material_types',
			'bom_material_types.id',
			'materials.material_type_id',
		)
		.select([
			'bom_material_types.id as material_type_id',
			'bom_material_types.name as material_type_name',
			'materials.color',
			'materials.size',
			'materials.purchase_url',
		])
		.where('materials.store_id', '=', store.id)
		.where('bom_material_types.name', 'ilike', `%${query}%`)
		.orderBy('bom_material_types.name', 'asc')
		.orderBy('materials.color', 'asc')
		.limit(10);

	if (measurement) {
		q = q.where(
			'bom_material_types.measurement',
			'=',
			measurement as 'area' | 'linear' | 'count',
		);
	}

	return q.execute();
}

export async function searchMaterials(
	userId: string,
	materialTypeId: string,
	query: string,
) {
	const store = await getStoreForUser(userId);
	if (!store) return [];

	return db
		.selectFrom('materials')
		.innerJoin(
			'bom_material_types',
			'bom_material_types.id',
			'materials.material_type_id',
		)
		.select([
			'materials.id',
			'materials.material_type_id',
			'materials.color',
			'materials.size',
			'materials.purchase_url',
			'bom_material_types.name as material_type_name',
		])
		.where('materials.store_id', '=', store.id)
		.where('materials.material_type_id', '=', materialTypeId)
		.where((eb) =>
			eb.or([
				eb('materials.color', 'ilike', `%${query}%`),
				eb('materials.size', 'ilike', `%${query}%`),
			]),
		)
		.orderBy('materials.color', 'asc')
		.limit(5)
		.execute();
}

export async function getOrCreateMaterial(
	userId: string,
	materialTypeId: string,
	color: string | null,
	size: string | null,
	purchaseUrl: string | null,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const existing = await db
		.selectFrom('materials')
		.selectAll()
		.where('store_id', '=', store.id)
		.where('material_type_id', '=', materialTypeId)
		.where((eb) => (color ? eb('color', '=', color) : eb('color', 'is', null)))
		.where((eb) => (size ? eb('size', '=', size) : eb('size', 'is', null)))
		.executeTakeFirst();

	if (existing) {
		if (existing.purchase_url !== purchaseUrl) {
			await db
				.updateTable('materials')
				.set({ purchase_url: purchaseUrl, updated_at: sql`NOW()` })
				.where('id', '=', existing.id)
				.execute();
		}
		return existing;
	}

	return db
		.insertInto('materials')
		.values({
			store_id: store.id,
			material_type_id: materialTypeId,
			color,
			size,
			purchase_url: purchaseUrl,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
}

export async function getBomSuggestions(userId: string, query: string) {
	const store = await getStoreForUser(userId);
	if (!store) return [];

	const suggestions = await db
		.selectFrom('bom_items')
		.leftJoin('materials', 'materials.id', 'bom_items.material_id')
		.leftJoin(
			'bom_material_types',
			'bom_material_types.id',
			'materials.material_type_id',
		)
		.select([
			'bom_items.piece',
			'bom_items.material_id',
			'bom_items.measurement',
			'bom_items.length',
			'bom_items.quantity',
			'materials.color',
			'materials.size',
			'materials.purchase_url',
			'bom_material_types.name as material_type_name',
		])
		.where('bom_items.store_id', '=', store.id)
		.where('bom_items.piece', 'ilike', `%${query}%`)
		.orderBy('bom_items.piece', 'asc')
		.limit(20)
		.execute();

	const seen = new Set<string>();
	return suggestions.filter((s) => {
		const key = `${s.piece}|${s.material_id}|${s.color}|${s.size}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
