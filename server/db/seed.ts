import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from './database-types.js';
import type { NewBomItem } from './database-types.js';
import { DEV_USER_ID, DEV_STORE_ID } from '../config/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DATA = path.join(__dirname, 'seed-data');

type FabricEntry = {
	platform_sku: string;
	product_name: string;
	variant: string;
	piece: string;
	color: string;
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
			full_name: 'Jaclyn Cage',
		})
		.onConflict((oc) =>
			oc.column('id').doUpdateSet({
				email: 'jaclyn@salkadesigns.com',
				full_name: 'Jaclyn Cage',
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

	const materialTypes = [
		{ name: 'X50 Fabric', measurement: 'count' as const, unit: 'pieces' as const, tracks_color: true, tracks_dimensions: false, position: 0 },
		{ name: 'Zipper Tape', measurement: 'linear' as const, unit: 'inches' as const, tracks_color: false, tracks_dimensions: true, position: 1 },
		{ name: 'Webbing', measurement: 'linear' as const, unit: 'inches' as const, tracks_color: false, tracks_dimensions: true, position: 2 },
		{ name: 'Elastic', measurement: 'linear' as const, unit: 'inches' as const, tracks_color: false, tracks_dimensions: true, position: 3 },
		{ name: 'Grosgrain', measurement: 'linear' as const, unit: 'inches' as const, tracks_color: false, tracks_dimensions: true, position: 4 },
		{ name: 'Hardware', measurement: 'count' as const, unit: 'pieces' as const, tracks_color: false, tracks_dimensions: false, position: 5 },
	];

	await db.deleteFrom('bom_items').where('store_id', '=', DEV_STORE_ID).execute();
	await db.deleteFrom('bom_material_types').where('store_id', '=', DEV_STORE_ID).execute();

	const insertedTypes = await db
		.insertInto('bom_material_types')
		.values(materialTypes.map((t) => ({ ...t, store_id: DEV_STORE_ID })))
		.returning(['id', 'name'])
		.execute();

	const typeIdByName = new Map(insertedTypes.map((t) => [t.name, t.id]));

	const fabricData = loadJson<FabricEntry[]>('bom-fabric.json');
	const fabricRows: NewBomItem[] = fabricData.map((entry) => ({
		store_id: DEV_STORE_ID,
		material_type_id: typeIdByName.get('X50 Fabric')!,
		platform_sku: entry.platform_sku,
		product_name: entry.product_name,
		variant: entry.variant,
		piece: entry.piece,
		color: entry.color,
		quantity: entry.quantity,
	}));

	const hardwareData = loadJson<HardwareEntry[]>('bom-hardware.json');
	const hardwareRows: NewBomItem[] = hardwareData.map((entry) => ({
		store_id: DEV_STORE_ID,
		material_type_id: typeIdByName.get(entry.material_type)!,
		platform_sku: entry.platform_sku,
		product_name: entry.product_name,
		variant: entry.variant,
		piece: entry.piece,
		length: entry.length?.toString() ?? null,
		width: entry.width?.toString() ?? null,
		quantity: entry.quantity,
	}));

	const allRows = [...fabricRows, ...hardwareRows];
	const BATCH_SIZE = 100;

	for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
		await db
			.insertInto('bom_items')
			.values(allRows.slice(i, i + BATCH_SIZE))
			.execute();
	}

	console.log(`  BOM: ${fabricRows.length} fabric + ${hardwareRows.length} hardware entries`);

	await db.destroy();
	console.log('Seed complete');
}

seed();
