import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import { TEST_STORE_ID } from '../../tests/test-constants.js';
import { db } from '../../db/connection.js';

const UNKNOWN_ID = '11111111-1111-4111-8111-111111111111';

const materialIdByColor = async (color: string, type = 'Leather') => {
	const row = await db
		.selectFrom('materials')
		.innerJoin(
			'bom_material_types',
			'bom_material_types.id',
			'materials.material_type_id',
		)
		.select('materials.id')
		.where('materials.store_id', '=', TEST_STORE_ID)
		.where('bom_material_types.name', '=', type)
		.where('materials.color', '=', color)
		.executeTakeFirstOrThrow();
	return row.id;
};

describe('Materials API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('GET /materials returns the library with usage counts', async () => {
		const response = await app.inject(withAuth('GET', '/materials'));
		const data = response.json().data;

		expect(response.statusCode).toBe(200);
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBeGreaterThan(0);

		const material = data[0];
		expect(material).toHaveProperty('material_type_name');
		expect(material).toHaveProperty('usage_count');
		expect(typeof material.usage_count).toBe('number');
		expect(data.some((m: { usage_count: number }) => m.usage_count > 0)).toBe(
			true,
		);
	});

	it('PATCH updates a material purchase url', async () => {
		const id = await materialIdByColor('White', 'Thread');

		try {
			const response = await app.inject(
				withAuth('PATCH', `/materials/${id}`, {
					payload: { purchase_url: 'https://example.com/thread' },
				}),
			);

			expect(response.statusCode).toBe(200);
			expect(response.json().data.purchase_url).toBe(
				'https://example.com/thread',
			);
		} finally {
			await db
				.updateTable('materials')
				.set({ purchase_url: null })
				.where('id', '=', id)
				.execute();
		}
	});

	it('PATCH rejects a color and size that already exists', async () => {
		const id = await materialIdByColor('Black');

		const response = await app.inject(
			withAuth('PATCH', `/materials/${id}`, { payload: { color: 'Tan' } }),
		);

		expect(response.statusCode).toBe(409);
	});

	it('DELETE is blocked while the material is used in a BOM', async () => {
		const id = await materialIdByColor('Black');

		const response = await app.inject(withAuth('DELETE', `/materials/${id}`));

		expect(response.statusCode).toBe(409);
	});

	it('DELETE removes a material that is not used', async () => {
		const leatherTypeId = await db
			.selectFrom('bom_material_types')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('name', '=', 'Leather')
			.executeTakeFirstOrThrow();

		const created = await db
			.insertInto('materials')
			.values({
				store_id: TEST_STORE_ID,
				material_type_id: leatherTypeId.id,
				color: 'Delete Me',
				size: null,
				purchase_url: null,
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		try {
			const response = await app.inject(
				withAuth('DELETE', `/materials/${created.id}`),
			);
			expect(response.statusCode).toBe(200);

			const stillThere = await db
				.selectFrom('materials')
				.select('id')
				.where('id', '=', created.id)
				.executeTakeFirst();
			expect(stillThere).toBeUndefined();
		} finally {
			await db.deleteFrom('materials').where('id', '=', created.id).execute();
		}
	});

	it('POST creates a material under an existing type', async () => {
		const type = await db
			.selectFrom('bom_material_types')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('name', '=', 'Leather')
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('POST', '/materials', {
				payload: { material_type_id: type.id, color: 'Forest' },
			}),
		);

		expect(response.statusCode).toBe(201);
		const created = response.json().data;
		expect(created.color).toBe('Forest');

		await db.deleteFrom('materials').where('id', '=', created.id).execute();
	});

	it('POST creates the material type when given a name', async () => {
		const response = await app.inject(
			withAuth('POST', '/materials', {
				payload: {
					material_type_name: 'Webbing',
					measurement: 'linear',
					size: '1in',
				},
			}),
		);

		expect(response.statusCode).toBe(201);
		const created = response.json().data;

		const type = await db
			.selectFrom('bom_material_types')
			.select(['id', 'measurement'])
			.where('store_id', '=', TEST_STORE_ID)
			.where('name', '=', 'Webbing')
			.executeTakeFirstOrThrow();
		expect(type.measurement).toBe('linear');

		await db.deleteFrom('materials').where('id', '=', created.id).execute();
		await db
			.deleteFrom('bom_material_types')
			.where('id', '=', type.id)
			.execute();
	});

	it('POST rejects a duplicate material', async () => {
		const type = await db
			.selectFrom('bom_material_types')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('name', '=', 'Leather')
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('POST', '/materials', {
				payload: { material_type_id: type.id, color: 'Black' },
			}),
		);

		expect(response.statusCode).toBe(409);
	});

	it('returns 404 for an unknown material', async () => {
		const response = await app.inject(
			withAuth('DELETE', `/materials/${UNKNOWN_ID}`),
		);

		expect(response.statusCode).toBe(404);
	});
});
