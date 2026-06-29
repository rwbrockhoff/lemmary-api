import { sql } from 'kysely';
import { db } from '../db/connection.js';

export type Measurement = 'area' | 'linear' | 'count';

const MEASUREMENT_DEFAULTS: Record<
	Measurement,
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

type MaterialTypeInput = {
	material_type_id?: string | null;
	material_type_name?: string | null;
	measurement: Measurement;
};

// returns an existing type id, or finds or creates one by name within the store
export async function getOrCreateMaterialType(
	storeId: string,
	input: MaterialTypeInput,
): Promise<string | null> {
	if (input.material_type_id) return input.material_type_id;

	const trimmedName = input.material_type_name?.trim();
	if (!trimmedName) return null;

	const findByName = () =>
		db
			.selectFrom('bom_material_types')
			.select('id')
			.where('store_id', '=', storeId)
			.where(sql<boolean>`lower(name) = lower(${trimmedName})`)
			.where('measurement', '=', input.measurement)
			.executeTakeFirst();

	const existing = await findByName();
	if (existing) return existing.id;

	const maxPos = await db
		.selectFrom('bom_material_types')
		.select(sql<number>`coalesce(max(position), 0)`.as('max_pos'))
		.where('store_id', '=', storeId)
		.executeTakeFirst();

	const defaults =
		MEASUREMENT_DEFAULTS[input.measurement] ?? MEASUREMENT_DEFAULTS.count;

	const inserted = await db
		.insertInto('bom_material_types')
		.values({
			store_id: storeId,
			name: trimmedName,
			measurement: input.measurement,
			...defaults,
			position: (maxPos?.max_pos ?? 0) + 1,
		})
		.onConflict((oc) => oc.doNothing())
		.returning('id')
		.executeTakeFirst();

	if (inserted) return inserted.id;

	const raced = await findByName();
	return raced?.id ?? null;
}
