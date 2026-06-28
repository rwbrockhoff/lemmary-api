import { sql, type SqlBool } from 'kysely';
import { db } from '../../db/connection.js';
import type { MaterialUpdate } from '../../db/database-types.js';
import { getStoreForUser } from '../../utils/store.js';
import { AppError } from '../../utils/app-error.js';
import type { UpdateMaterialRequest } from './contract/types.js';

export async function getMaterials(userId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return [];

	return db
		.selectFrom('materials')
		.innerJoin(
			'bom_material_types',
			'bom_material_types.id',
			'materials.material_type_id',
		)
		.leftJoin('bom_items', 'bom_items.material_id', 'materials.id')
		.select([
			'materials.id',
			'materials.material_type_id',
			'bom_material_types.name as material_type_name',
			'bom_material_types.measurement',
			'materials.color',
			'materials.size',
			'materials.purchase_url',
			'materials.created_at',
			'materials.updated_at',
		])
		.select(sql<number>`count(bom_items.id)::int`.as('usage_count'))
		.where('materials.store_id', '=', store.id)
		.groupBy(['materials.id', 'bom_material_types.id'])
		.orderBy('bom_material_types.name', 'asc')
		.orderBy('materials.color', 'asc')
		.execute();
}

export async function updateMaterial(
	userId: string,
	materialId: string,
	input: UpdateMaterialRequest,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const existing = await db
		.selectFrom('materials')
		.selectAll()
		.where('id', '=', materialId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!existing) return null;

	if (input.color !== undefined || input.size !== undefined) {
		const nextColor = input.color ?? existing.color;
		const nextSize = input.size ?? existing.size;

		const clash = await db
			.selectFrom('materials')
			.select('id')
			.where('store_id', '=', store.id)
			.where('material_type_id', '=', existing.material_type_id)
			.where('id', '!=', materialId)
			.where(sql<SqlBool>`color is not distinct from ${nextColor}`)
			.where(sql<SqlBool>`size is not distinct from ${nextSize}`)
			.executeTakeFirst();

		if (clash) {
			throw AppError.conflict(
				'A material with that color and size already exists',
			);
		}
	}

	const updates: MaterialUpdate = {};
	if (input.color !== undefined) updates.color = input.color;
	if (input.size !== undefined) updates.size = input.size;
	if (input.purchase_url !== undefined)
		updates.purchase_url = input.purchase_url;

	const result = await db
		.updateTable('materials')
		.set({ ...updates, updated_at: sql`NOW()` })
		.where('id', '=', materialId)
		.where('store_id', '=', store.id)
		.returningAll()
		.executeTakeFirst();

	return result ?? null;
}

export async function deleteMaterial(userId: string, materialId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return false;

	const existing = await db
		.selectFrom('materials')
		.select('id')
		.where('id', '=', materialId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!existing) return false;

	const usage = await db
		.selectFrom('bom_items')
		.select(sql<number>`count(*)::int`.as('count'))
		.where('material_id', '=', materialId)
		.where('store_id', '=', store.id)
		.executeTakeFirstOrThrow();

	if (usage.count > 0) {
		const plural = usage.count === 1 ? 'item' : 'items';
		throw AppError.conflict(`Material is used in ${usage.count} BOM ${plural}`);
	}

	const result = await db
		.deleteFrom('materials')
		.where('id', '=', materialId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	return result.numDeletedRows > 0n;
}
