import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';
import pg from 'pg';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { faker } from '@faker-js/faker';
import { DEMO_CUSTOMERS } from './data/demo/demo-customers.js';
import { DEV_ORDER_STAGES, DEV_ITEM_STAGES } from './data/dev/dev-workflow.js';
import type { Database } from '../database-types.js';
import {
	DEV_USER_ID,
	DEV_STORE_ID,
	SHOPIFY_TEST_USER_ID,
	SHOPIFY_TEST_EMAIL,
} from '../../config/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DATA = path.join(__dirname, 'data');

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
			email: 'dev@lemmary.com',
			first_name: 'Dev',
			last_name: 'User',
		})
		.onConflict((oc) =>
			oc.column('id').doUpdateSet({
				email: 'dev@lemmary.com',
				first_name: 'Dev',
				last_name: 'User',
			}),
		)
		.execute();

	// Add Shopify user for dev
	await db
		.insertInto('users')
		.values({
			id: SHOPIFY_TEST_USER_ID,
			email: SHOPIFY_TEST_EMAIL,
			first_name: 'Shopify',
			last_name: 'Test',
		})
		.onConflict((oc) =>
			oc.column('id').doUpdateSet({ email: SHOPIFY_TEST_EMAIL }),
		)
		.execute();

	// Free access so the billing gate doesn't lock dev out
	await db
		.insertInto('account_grants')
		.values({ user_id: DEV_USER_ID, note: 'dev' })
		.onConflict((oc) => oc.column('user_id').doNothing())
		.execute();

	const encryptedToken = sql<Buffer>`pgp_sym_encrypt(${process.env.SQUARESPACE_API_KEY ?? ''}, ${process.env.STORE_ENCRYPTION_KEY})`;

	const platformConfig = {
		base_url: 'https://api.squarespace.com/1.0',
		api_version: '1.0',
		store_url: process.env.SQUARESPACE_STORE_URL ?? null,
	};

	await db
		.insertInto('stores')
		.values({
			id: DEV_STORE_ID,
			user_id: DEV_USER_ID,
			platform: 'squarespace',
			store_name: 'Dev Store',
			store_access_token: encryptedToken,
			lead_time_days: 21,
			platform_config: platformConfig,
		})
		.onConflict((oc) =>
			oc.column('id').doUpdateSet({
				store_access_token: encryptedToken,
				store_name: 'Dev Store',
				platform_config: platformConfig,
			}),
		)
		.execute();

	await db
		.deleteFrom('order_workflow_stages')
		.where('store_id', '=', DEV_STORE_ID)
		.execute();
	await db
		.deleteFrom('order_item_workflow_stages')
		.where('store_id', '=', DEV_STORE_ID)
		.execute();

	await db
		.insertInto('order_workflow_stages')
		.values(DEV_ORDER_STAGES.map((s) => ({ ...s, store_id: DEV_STORE_ID })))
		.execute();

	await db
		.insertInto('order_item_workflow_stages')
		.values(DEV_ITEM_STAGES.map((s) => ({ ...s, store_id: DEV_STORE_ID })))
		.execute();

	console.log('  Workflow stages seeded');

	const materialTypes = [
		{
			name: 'EPX 200',
			measurement: 'area' as const,
			unit: 'pieces' as const,
			tracks_color: true,
			tracks_size: false,
			position: 0,
		},
		{
			name: 'RX 30',
			measurement: 'area' as const,
			unit: 'pieces' as const,
			tracks_color: true,
			tracks_size: false,
			position: 1,
		},
		{
			name: 'Venom Gridstop ECO',
			measurement: 'area' as const,
			unit: 'pieces' as const,
			tracks_color: true,
			tracks_size: false,
			position: 2,
		},
		{
			name: '200D RBC',
			measurement: 'area' as const,
			unit: 'pieces' as const,
			tracks_color: true,
			tracks_size: false,
			position: 3,
		},
		{
			name: '420D Robic',
			measurement: 'area' as const,
			unit: 'pieces' as const,
			tracks_color: true,
			tracks_size: false,
			position: 4,
		},
		{
			name: 'Zipper Tape',
			measurement: 'linear' as const,
			unit: 'inches' as const,
			tracks_color: false,
			tracks_size: true,
			position: 5,
		},
		{
			name: 'Webbing',
			measurement: 'linear' as const,
			unit: 'inches' as const,
			tracks_color: false,
			tracks_size: true,
			position: 6,
		},
		{
			name: 'Elastic',
			measurement: 'linear' as const,
			unit: 'inches' as const,
			tracks_color: false,
			tracks_size: true,
			position: 7,
		},
		{
			name: 'Grosgrain',
			measurement: 'linear' as const,
			unit: 'inches' as const,
			tracks_color: false,
			tracks_size: true,
			position: 8,
		},
		{
			name: 'Zipper Slider',
			measurement: 'count' as const,
			unit: 'pieces' as const,
			tracks_color: false,
			tracks_size: false,
			position: 9,
		},
		{
			name: 'Zipper Pull',
			measurement: 'count' as const,
			unit: 'pieces' as const,
			tracks_color: false,
			tracks_size: false,
			position: 10,
		},
		{
			name: 'Label',
			measurement: 'count' as const,
			unit: 'pieces' as const,
			tracks_color: false,
			tracks_size: false,
			position: 11,
		},
		{
			name: 'Belt Buckle',
			measurement: 'count' as const,
			unit: 'pieces' as const,
			tracks_color: false,
			tracks_size: false,
			position: 12,
		},
		{
			name: 'Slik Clips',
			measurement: 'count' as const,
			unit: 'pieces' as const,
			tracks_color: false,
			tracks_size: false,
			position: 13,
		},
	];

	await db
		.deleteFrom('bom_items')
		.where('store_id', '=', DEV_STORE_ID)
		.execute();
	await db
		.deleteFrom('materials')
		.where('store_id', '=', DEV_STORE_ID)
		.execute();
	await db
		.deleteFrom('bom_material_types')
		.where('store_id', '=', DEV_STORE_ID)
		.execute();

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
		const materialId = await getOrCreateMaterial(
			entry.fabric_type,
			entry.color,
			null,
		);
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

	const linearTypes = new Set([
		'Zipper Tape',
		'Webbing',
		'Elastic',
		'Grosgrain',
	]);

	for (const entry of hardwareData) {
		const isLinear = linearTypes.has(entry.material_type);
		const measurement = isLinear ? 'linear' : 'count';
		const size = isLinear
			? (entry.width?.toString() ?? null)
			: (entry.width?.toString() ?? null);

		const materialId = await getOrCreateMaterial(
			entry.material_type,
			null,
			size,
		);
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
	console.log(
		`  BOM: ${fabricData.length} fabric + ${hardwareData.length} hardware entries`,
	);

	// Adds 3 custom orders for dev (e.g. C-1)
	faker.seed(42);

	const defaultOrderStage = await db
		.selectFrom('order_workflow_stages')
		.select('id')
		.where('store_id', '=', DEV_STORE_ID)
		.where('is_default', '=', true)
		.executeTakeFirstOrThrow();

	const defaultItemStage = await db
		.selectFrom('order_item_workflow_stages')
		.select('id')
		.where('store_id', '=', DEV_STORE_ID)
		.where('is_default', '=', true)
		.executeTakeFirstOrThrow();

	await db
		.deleteFrom('orders')
		.where('store_id', '=', DEV_STORE_ID)
		.where('order_type', 'in', ['custom', 'work'])
		.execute();

	const distinctProducts = [
		...new Map(fabricData.map((entry) => [entry.platform_sku, entry])).values(),
	];

	const CUSTOM_ORDER_COUNT = 3;

	for (let i = 0; i < CUSTOM_ORDER_COUNT; i++) {
		const customerName = faker.helpers.arrayElement(DEMO_CUSTOMERS);
		const orderDate = faker.date.recent({ days: 30 });
		const dueDate = new Date(orderDate);
		dueDate.setDate(dueDate.getDate() + 21);
		const orderNumber = `C-${i + 1}`;

		const products = faker.helpers.arrayElements(
			distinctProducts,
			faker.number.int({ min: 1, max: 3 }),
		);
		const items = products.map((product) => ({
			product,
			quantity: faker.number.int({ min: 1, max: 4 }),
			unitPrice: Number(faker.commerce.price({ min: 40, max: 200 })),
		}));
		const subtotal = items.reduce(
			(sum, item) => sum + item.unitPrice * item.quantity,
			0,
		);

		const order = await db
			.insertInto('orders')
			.values({
				store_id: DEV_STORE_ID,
				order_type: 'custom',
				platform_order_id: null,
				order_number: orderNumber,
				customer_name: customerName,
				customer_email: `${customerName.toLowerCase().replace(/\s/g, '.')}@example.com`,
				order_date: orderDate,
				fulfillment_status: 'pending',
				due_date: dueDate.toISOString().slice(0, 10),
				workflow_stage_id: defaultOrderStage.id,
				subtotal: subtotal.toFixed(2),
				shipping_total: '0.00',
				grand_total: subtotal.toFixed(2),
				currency: 'USD',
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		await db
			.insertInto('order_items')
			.values(
				items.map((item) => ({
					order_id: order.id,
					platform_line_item_id: null,
					platform_sku: item.product.platform_sku,
					product_name: item.product.product_name,
					variant_label: sql`${JSON.stringify([{ name: 'Variant', value: item.product.variant }])}::jsonb`,
					quantity: item.quantity,
					unit_price: item.unitPrice.toFixed(2),
					workflow_stage_id: defaultItemStage.id,
				})),
			)
			.execute();
	}

	console.log(`  Custom orders: ${CUSTOM_ORDER_COUNT} seeded`);

	// Adds 1 work order for dev (e.g. WO-1)
	const workProducts = faker.helpers.arrayElements(distinctProducts, 2);
	const workOrderDate = faker.date.recent({ days: 14 });
	const workDueDate = new Date(workOrderDate);
	workDueDate.setDate(workDueDate.getDate() + 21);

	const workOrder = await db
		.insertInto('orders')
		.values({
			store_id: DEV_STORE_ID,
			order_type: 'work',
			platform_order_id: null,
			order_number: 'WO-1',
			order_title: 'Restock backstock slings',
			order_date: workOrderDate,
			fulfillment_status: 'pending',
			due_date: workDueDate.toISOString().slice(0, 10),
			workflow_stage_id: defaultOrderStage.id,
			currency: 'USD',
		})
		.returning('id')
		.executeTakeFirstOrThrow();

	await db
		.insertInto('order_items')
		.values(
			workProducts.map((product) => ({
				order_id: workOrder.id,
				platform_line_item_id: null,
				platform_sku: product.platform_sku,
				product_name: product.product_name,
				variant_label: sql`${JSON.stringify([{ name: 'Variant', value: product.variant }])}::jsonb`,
				quantity: faker.number.int({ min: 2, max: 6 }),
				workflow_stage_id: defaultItemStage.id,
			})),
		)
		.execute();

	console.log('  Work orders: 1 seeded');

	await db.destroy();
	console.log('Seed complete');
}

seed();
