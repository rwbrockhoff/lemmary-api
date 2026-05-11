import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from './database-types.js';
import { DEV_USER_ID, DEV_STORE_ID } from '../config/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DATA = path.join(__dirname, 'seed-data');

type FabricEntry = {
	platform_sku: string;
	product_name: string;
	variant: string;
	piece: string;
	color: string;
	fabric_type: string;
	quantity: number;
};

type HardwareEntry = {
	platform_sku: string;
	product_name: string;
	variant: string;
	piece: string;
	material_type: string;
	length: number | null;
	width: number | null;
	quantity: number;
};

function loadJson<T>(filename: string): T {
	const raw = readFileSync(path.join(SEED_DATA, filename), 'utf-8');
	return JSON.parse(raw) as T;
}

async function seed() {
	const db = new Kysely<Database>({
		dialect: new PostgresDialect({
			pool: new pg.Pool({
				connectionString: process.env.DATABASE_URL,
			}),
		}),
	});

	console.log('Seeding development data...');

	await db
		.insertInto('users')
		.values({
			id: DEV_USER_ID,
			email: 'jaclyn@salkadesigns.com',
			first_name: 'Jaclyn',
			last_name: 'Cage',
		})
		.onConflict((oc) =>
			oc.column('id').doUpdateSet({
				email: 'jaclyn@salkadesigns.com',
				first_name: 'Jaclyn',
				last_name: 'Cage',
			}),
		)
		.execute();

	await db
		.insertInto('stores')
		.values({
			id: DEV_STORE_ID,
			user_id: DEV_USER_ID,
			platform: 'squarespace',
			store_name: 'Salka Designs',
			api_key: process.env.SQUARESPACE_API_KEY ?? '',
			lead_time_days: 21,
			platform_config: {
				base_url: 'https://api.squarespace.com/1.0',
				api_version: '1.0',
			},
		})
		.onConflict((oc) =>
			oc.column('id').doUpdateSet({
				api_key: process.env.SQUARESPACE_API_KEY ?? '',
				store_name: 'Salka Designs',
			}),
		)
		.execute();

	await db.deleteFrom('order_workflow_stages').where('store_id', '=', DEV_STORE_ID).execute();
	await db.deleteFrom('order_item_workflow_stages').where('store_id', '=', DEV_STORE_ID).execute();

	await db
		.insertInto('order_workflow_stages')
		.values([
			{ store_id: DEV_STORE_ID, name: 'New', position: 0, color: 'gray', is_default: true, is_complete: false },
			{ store_id: DEV_STORE_ID, name: 'In Progress 🔄', position: 1, color: 'blue', is_default: false, is_complete: false },
			{ store_id: DEV_STORE_ID, name: 'Order Finished 🙌🏻', position: 2, color: 'purple', is_default: false, is_complete: false },
			{ store_id: DEV_STORE_ID, name: 'Ready to Ship 📦', position: 3, color: 'purple', is_default: false, is_complete: false },
			{ store_id: DEV_STORE_ID, name: 'Fulfilled 👏🏻', position: 4, color: 'green', is_default: false, is_complete: true },
		])
		.execute();

	await db
		.insertInto('order_item_workflow_stages')
		.values([
			{ store_id: DEV_STORE_ID, name: 'Not Started', position: 0, color: 'gray', is_default: true, is_complete: false },
			{ store_id: DEV_STORE_ID, name: 'Fabric Cut ✂️', position: 1, color: 'blue', is_default: false, is_complete: false },
			{ store_id: DEV_STORE_ID, name: 'Components Ready 📎', position: 2, color: 'blue', is_default: false, is_complete: false },
			{ store_id: DEV_STORE_ID, name: 'In Progress 🔄', position: 3, color: 'purple', is_default: false, is_complete: false },
			{ store_id: DEV_STORE_ID, name: 'Done 👏🏻', position: 4, color: 'green', is_default: false, is_complete: true },
		])
		.execute();

	console.log('  Workflow stages seeded');

	const materialTypes = [
		{ name: 'EPX 200', measurement: 'area' as const, unit: 'pieces' as const, tracks_color: true, tracks_size: false, position: 0 },
		{ name: 'RX 30', measurement: 'area' as const, unit: 'pieces' as const, tracks_color: true, tracks_size: false, position: 1 },
		{ name: 'Venom Gridstop ECO', measurement: 'area' as const, unit: 'pieces' as const, tracks_color: true, tracks_size: false, position: 2 },
		{ name: '200D RBC', measurement: 'area' as const, unit: 'pieces' as const, tracks_color: true, tracks_size: false, position: 3 },
		{ name: '420D Robic', measurement: 'area' as const, unit: 'pieces' as const, tracks_color: true, tracks_size: false, position: 4 },
		{ name: 'Zipper Tape', measurement: 'linear' as const, unit: 'inches' as const, tracks_color: false, tracks_size: true, position: 5 },
		{ name: 'Webbing', measurement: 'linear' as const, unit: 'inches' as const, tracks_color: false, tracks_size: true, position: 6 },
		{ name: 'Elastic', measurement: 'linear' as const, unit: 'inches' as const, tracks_color: false, tracks_size: true, position: 7 },
		{ name: 'Grosgrain', measurement: 'linear' as const, unit: 'inches' as const, tracks_color: false, tracks_size: true, position: 8 },
		{ name: 'Zipper Slider', measurement: 'count' as const, unit: 'pieces' as const, tracks_color: false, tracks_size: false, position: 9 },
		{ name: 'Zipper Pull', measurement: 'count' as const, unit: 'pieces' as const, tracks_color: false, tracks_size: false, position: 10 },
		{ name: 'Label', measurement: 'count' as const, unit: 'pieces' as const, tracks_color: false, tracks_size: false, position: 11 },
		{ name: 'Belt Buckle', measurement: 'count' as const, unit: 'pieces' as const, tracks_color: false, tracks_size: false, position: 12 },
		{ name: 'Slik Clips', measurement: 'count' as const, unit: 'pieces' as const, tracks_color: false, tracks_size: false, position: 13 },
	];

	await db.deleteFrom('bom_items').where('store_id', '=', DEV_STORE_ID).execute();
	await db.deleteFrom('materials').where('store_id', '=', DEV_STORE_ID).execute();
	await db.deleteFrom('bom_material_types').where('store_id', '=', DEV_STORE_ID).execute();

	const insertedTypes = await db
		.insertInto('bom_material_types')
		.values(materialTypes.map((t) => ({ ...t, store_id: DEV_STORE_ID })))
		.returning(['id', 'name', 'measurement'])
		.execute();

	const typeByName = new Map(insertedTypes.map((t) => [t.name, t]));

	const materialCache = new Map<string, string>();

	async function getOrCreateMaterial(
		materialTypeName: string,
		color: string | null,
		size: string | null,
	): Promise<string> {
		const key = `${materialTypeName}|${color ?? ''}|${size ?? ''}`;
		const cached = materialCache.get(key);
		if (cached) return cached;

		const type = typeByName.get(materialTypeName);
		if (!type) throw new Error(`Unknown material type: ${materialTypeName}`);

		const inserted = await db
			.insertInto('materials')
			.values({
				store_id: DEV_STORE_ID,
				material_type_id: type.id,
				color,
				size,
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		materialCache.set(key, inserted.id);
		return inserted.id;
	}

	const fabricData = loadJson<FabricEntry[]>('bom-fabric.json');
	let position = 0;

	for (const entry of fabricData) {
		const materialId = await getOrCreateMaterial(entry.fabric_type, entry.color, null);
		await db
			.insertInto('bom_items')
			.values({
				store_id: DEV_STORE_ID,
				material_id: materialId,
				measurement: 'area',
				platform_sku: entry.platform_sku,
				product_name: entry.product_name,
				variant: entry.variant,
				piece: entry.piece,
				quantity: entry.quantity,
				position: position++ * 1000,
			})
			.execute();
	}

	const hardwareData = loadJson<HardwareEntry[]>('bom-hardware.json');

	const linearTypes = new Set(['Zipper Tape', 'Webbing', 'Elastic', 'Grosgrain']);

	for (const entry of hardwareData) {
		const isLinear = linearTypes.has(entry.material_type);
		const measurement = isLinear ? 'linear' : 'count';
		const size = isLinear
			? (entry.width?.toString() ?? null)
			: (entry.width?.toString() ?? null);

		const materialId = await getOrCreateMaterial(entry.material_type, null, size);
		await db
			.insertInto('bom_items')
			.values({
				store_id: DEV_STORE_ID,
				material_id: materialId,
				measurement: measurement as 'linear' | 'count',
				platform_sku: entry.platform_sku,
				product_name: entry.product_name,
				variant: entry.variant,
				piece: entry.piece,
				length: entry.length?.toString() ?? null,
				quantity: entry.quantity,
				position: position++ * 1000,
			})
			.execute();
	}

	console.log(`  Materials: ${materialCache.size} unique materials`);
	console.log(`  BOM: ${fabricData.length} fabric + ${hardwareData.length} hardware entries`);

	await db.destroy();
	console.log('Seed complete');
}

seed();
